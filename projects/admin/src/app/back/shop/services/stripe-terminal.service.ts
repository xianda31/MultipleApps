/**
 * StripeTerminalService
 * Gestion du lecteur TPE physique via le SDK Stripe Terminal JS (Electron)
 * ou @capacitor-community/stripe-terminal (Android — ppTPE).
 *
 * Flux:
 * 1. init()              — charge le SDK selon la plateforme
 * 2. discoverReaders()   — liste les readers BLE/simulés disponibles
 * 3. connectReader()     — appaire un reader
 * 4. createPaymentIntent() — crée un PaymentIntent côté serveur (Lambda)
 * 5. collectAndProcess() — SDK collecte la carte et traite le paiement
 * 6. disconnectReader()  — libère le reader
 *
 * Plateforme Android  : @capacitor-community/stripe-terminal → BLE direct.
 * Plateforme Electron : @stripe/terminal-js → simulé (dev) ou internet.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { Schema } from '../../../../../../../amplify/data/resource';
import { SHARED_TPE_REQUEST_ID } from '../../../../../../common/tpe-shared';
import { Capacitor } from '@capacitor/core';
import {
  StripeTerminal,
  TerminalConnectTypes,
  TerminalEventsEnum,
  SimulatedCardType,
  SimulateReaderUpdate,
  type ReaderInterface,
} from '@capacitor-community/stripe-terminal';

export type TerminalStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'collecting'
  | 'success'
  | 'error'
  | 'disconnected';

export interface TerminalPaymentResult {
  paymentIntentId: string;
  stripeTag: string;
}

export interface RemotePaymentUncertainty {
  reason: string;
  paymentRequestId: string | null;
  paymentIntentId: string | null;
  bookEntryId: string | null;
}

export interface SharedTpeRequest {
  id: string;
  reservationId: string | null;
  origin: 'shop' | 'pointage' | 'ticketing';
  status: 'available' | 'reserved' | 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
  paymentIntentId: string;
  bookEntryId?: string | null;
  updatedAt?: string;
}

export interface SharedTpeResult {
  id: string;
  reservationId: string;
  status: 'success' | 'failed' | 'cancelled';
  paymentIntentId: string;
  bookEntryId?: string | null;
  buyerMemberId?: string | null;
}

interface SharedTpeReservationParams {
  amountCents: number;
  memberName: string;
  season: string;
  date: string;
  origin?: 'shop' | 'pointage' | 'ticketing';
  bookEntryId?: string;
  buyerMemberId?: string;
}

@Injectable({ providedIn: 'root' })
export class StripeTerminalService {
  private terminal: any = null;
  private reader: any = null;

  /** true quand on tourne sous Android (Capacitor) */
  private readonly isAndroid = Capacitor.isNativePlatform();
  private capacitorInitialized = false;

  private readonly _status$ = new BehaviorSubject<TerminalStatus>('idle');
  readonly status$ = this._status$.asObservable();

  private readonly _readerLabel$ = new BehaviorSubject<string>('');
  readonly readerLabel$ = this._readerLabel$.asObservable();

  private readonly _errorMessage$ = new BehaviorSubject<string>('');
  readonly errorMessage$ = this._errorMessage$.asObservable();

  /** Montant en attente d'un paiement distant (pour affichage dans les composants). */
  readonly remotePendingAmount$ = new BehaviorSubject<number>(0);
  /** Ne jamais nettoyer l'écriture ni réessayer sans rapprochement lorsque non null. */
  private readonly _remotePaymentUncertain$ = new BehaviorSubject<RemotePaymentUncertainty | null>(null);
  readonly remotePaymentUncertain$ = this._remotePaymentUncertain$.asObservable();
  get remotePaymentUncertainty(): RemotePaymentUncertainty | null {
    return this._remotePaymentUncertain$.value;
  }

  // ── Remote mode (PC) : relay AppSync → ppTPE ─────────────────────────────
  private _pendingPaymentRequestId: string | null = null;
  private _pendingPaymentIntentId: string | null = null;
  private _pendingBookEntryId: string | null = null;
  private _pendingPaymentTimeout: any = null;
  private _paymentRequestSub: any = null;
  private _sharedResultSub: { unsubscribe(): void } | null = null;
  private _remoteStarting = false;
  private _remoteSettling = false;
  private _sharedReservationId: string | null = null;
  private _sharedStateSub: { unsubscribe(): void } | null = null;
  readonly sharedRequest$ = new BehaviorSubject<SharedTpeRequest | null | undefined>(undefined);

  get sharedTpeEnabled(): boolean {
    return environment.tpe_shared_enabled && !this.isAndroid;
  }

  private readonly API_NAME = 'ffbProxyApi';

  get isConnected(): boolean {
    return !!this.reader;
  }

  get currentStatus(): TerminalStatus {
    return this._status$.value;
  }

  get isNativeAndroid(): boolean {
    return this.isAndroid;
  }

  // ──────────────────────────────────────────────────────────
  // Initialisation
  // ──────────────────────────────────────────────────────────

  /**
   * Charge le SDK Stripe Terminal (une seule fois) et crée l'instance.
   * Sur Android : initialise le plugin Capacitor.
   * Sur Electron/web : charge @stripe/terminal-js.
   */
  async init(): Promise<void> {
    if (this.isAndroid) {
      await this.initCapacitor();
    } else {
      await this.initWeb();
    }
  }

  private async initWeb(): Promise<void> {
    if (this.terminal) return;
    const { loadStripeTerminal } = await import('@stripe/terminal-js');
    const StripeTerminalJS = await loadStripeTerminal();
    if (!StripeTerminalJS) throw new Error('[StripeTerminal] Impossible de charger le SDK');
    this.terminal = StripeTerminalJS.create({
      onFetchConnectionToken: () => this.fetchConnectionToken(),
      onUnexpectedReaderDisconnect: () => {
        this.reader = null;
        this._status$.next('disconnected');
        this._readerLabel$.next('');
      },
    });
  }

  private async initCapacitor(): Promise<void> {
    if (this.capacitorInitialized) return;

    // Fournir le connection token quand le plugin le demande
    await StripeTerminal.addListener(
      TerminalEventsEnum.RequestedConnectionToken,
      async () => {
        try {
          const token = await this.fetchConnectionToken();
          await StripeTerminal.setConnectionToken({ token });
        } catch (e: any) {
          console.error('[StripeTerminal] fetchConnectionToken échoué:', e?.message);
        }
      },
    );

    // Déconnexion inattendue
    await StripeTerminal.addListener(
      TerminalEventsEnum.UnexpectedReaderDisconnect,
      () => {
        this.reader = null;
        this._status$.next('disconnected');
        this._readerLabel$.next('');
      },
    );

    // Attendre que le SDK soit pleinement initialisé (event Loaded)
    // avant de résoudre — sinon discoverReaders() échoue silencieusement
    await new Promise<void>((resolve) => {
      StripeTerminal.addListener(TerminalEventsEnum.Loaded, () => resolve());
      StripeTerminal.initialize({ isTest: environment.tpe_isTest });
    });

    this.capacitorInitialized = true;
  }

  // ──────────────────────────────────────────────────────────
  // Discovery & Connection
  // ──────────────────────────────────────────────────────────

  /**
   * Découvre les readers disponibles.
   * Simulated : readers virtuels Stripe (dev/staging, aucun matériel requis) — method internet.
   * Production Electron : WisePad 3 via Bluetooth LE — method bluetooth.
   */
  async discoverReaders(simulated = false): Promise<any[]> {
    await this.init();

    if (this.isAndroid) {
      return new Promise<ReaderInterface[]>((resolve) => {
        let handle: any;

        // Timeout 15s — annule le scan si aucun reader trouvé
        const timer = setTimeout(() => {
          handle?.remove();
          StripeTerminal.cancelDiscoverReaders().catch(() => {});
          resolve([]);
        }, 15000);

        // Les readers arrivent via event, pas dans la Promise
        StripeTerminal.addListener(
          TerminalEventsEnum.DiscoveredReaders,
          ({ readers }) => {
            clearTimeout(timer);
            handle?.remove();
            StripeTerminal.cancelDiscoverReaders().catch(() => {});
            resolve(readers ?? []);
          },
        ).then(h => { handle = h; });

        StripeTerminal.discoverReaders({
          type: environment.tpe_simulated ? TerminalConnectTypes.Internet : TerminalConnectTypes.Bluetooth,
          locationId: environment.tpe_location_id,
        }).catch(() => {}); // résultat ignoré — readers via event
      });
    }

    // Electron / web : SDK JS
    if (!simulated && !('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth non disponible dans ce navigateur/Electron.');
    }
    const config = simulated
      ? { simulated: true }
      : { simulated: false, discoveryMethod: 'bluetooth' };
    const result = await this.terminal.discoverReaders(config);
    if ((result as any).error) throw new Error((result as any).error.message);
    return (result as any).discoveredReaders as any[];
  }

  /**
   * Connecte un reader.
   * Simulated/internet : connectReader standard.
   * Bluetooth (WisePad 3) : connectBluetoothReader avec auto-reconnect activé.
   */
  async connectReader(reader: any): Promise<void> {
    this._status$.next('connecting');
    this._errorMessage$.next('');

    if (this.isAndroid) {
      await StripeTerminal.connectReader({
        reader: reader as ReaderInterface,
        autoReconnectOnUnexpectedDisconnect: true,
      });
      this.reader = reader;
      this._status$.next('connected');
      this._readerLabel$.next(reader.label || reader.serialNumber || 'WisePad 3');
      return;
    }

    // Electron / web
    const isBluetooth = reader.device_type === 'bbpos_wisepad3'
      || (reader as any).discoveryMethod === 'bluetooth'
      || (!reader.ip_address && !reader.base_url);

    const connectFn = isBluetooth
      ? () => (this.terminal as any).connectBluetoothReader(reader, {
          fail_if_in_use: false,
          autoReconnectOnUnexpectedDisconnect: true,
        })
      : () => this.terminal.connectReader(reader, { fail_if_in_use: false });

    const result = await connectFn();
    if ((result as any).error) {
      this._status$.next('error');
      this._errorMessage$.next((result as any).error.message);
      throw new Error((result as any).error.message);
    }
    this.reader = (result as any).reader;
    this._status$.next('connected');
    this._readerLabel$.next(reader.label || reader.id || 'WisePad 3');
  }

  /**
   * Déconnecte le reader actuel.
   */
  async disconnectReader(): Promise<void> {
    if (!this.reader) return;
    if (this.isAndroid) {
      await StripeTerminal.disconnectReader();
    } else {
      if (this.terminal) await this.terminal.disconnectReader();
    }
    this.reader = null;
    this._status$.next('idle');
    this._readerLabel$.next('');
  }

  // ──────────────────────────────────────────────────────────
  // Paiement
  // ──────────────────────────────────────────────────────────

  /**
   * Crée un PaymentIntent côté serveur (Lambda stripe-checkout) pour card_present.
   */
  async createPaymentIntent(params: {
    amountCents: number;
    memberName: string;
    memberFirstName?: string;
    buyerMemberId?: string;
    buyerEmail?: string;
    season: string;
    date: string;
    bookEntryId?: string;
  }): Promise<{ clientSecret: string; paymentIntentId: string; stripeTag: string }> {
    const authToken = await this.getAuthToken();

    const restOp = post({
      apiName: this.API_NAME,
      path: '/api/stripe/terminal-payment-intent',
      options: {
        body: params as any,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      },
    });

    const { body } = await restOp.response;
    const json = JSON.parse(await body.text());
    if (json.error) throw new Error(json.error);
    return json;
  }

  /**
   * Annule un PaymentIntent en attente côté Stripe (Lambda stripe-checkout).
   * Silencieux si déjà capturé ou annulé.
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    const authToken = await this.getAuthToken();
    const restOp = post({
      apiName: this.API_NAME,
      path: '/api/stripe/terminal-payment-intent',
      options: {
        body: {
          action: 'cancel',
          paymentIntentId,
          ...(this.sharedTpeEnabled ? { verifyExisting: true } : {}),
        } as any,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      },
    });
    const { body } = await restOp.response;
    const json = JSON.parse(await body.text());
    if (json.error) throw new Error(json.error);
    this._assertCancellationConfirmed(json.status);
  }

  private async deletePendingBookEntry(bookEntryId: string, paymentIntentId?: string | null): Promise<void> {
    const authToken = await this.getAuthToken();
    const restOp = post({
      apiName: this.API_NAME,
      path: '/api/stripe/terminal-payment-intent',
      options: {
        body: { action: 'cleanup', bookEntryId, paymentIntentId } as any,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      },
    });
    const { body } = await restOp.response;
    const json = JSON.parse(await body.text());
    if (json.status !== 'removed') throw new Error(json.error || 'Nettoyage comptable non confirmé');
  }

  private _assertCancellationConfirmed(status: string | undefined): void {
    if (status !== 'canceled') {
      throw new Error(`Annulation Stripe non confirmée (statut: ${status || 'inconnu'})`);
    }
  }

  /**
   * Collecte le moyen de paiement via le TPE puis traite le paiement.
   * Retourne le résultat avec paymentIntentId et stripeTag.
   */
  async collectAndProcess(clientSecret: string): Promise<TerminalPaymentResult> {
    await this.init();
    this._status$.next('collecting');
    this._errorMessage$.next('');

    if (this.isAndroid) {
      return new Promise<TerminalPaymentResult>((resolve, reject) => {
        let hConfirmed: any;
        let hFailed: any;
        let hCanceled: any;

        const cleanup = () => {
          hConfirmed?.remove();
          hFailed?.remove();
          hCanceled?.remove();
        };

        // paymentIntentId = partie avant "_secret_" dans le clientSecret
        const paymentIntentId = clientSecret.split('_secret_')[0];

        StripeTerminal.addListener(
          TerminalEventsEnum.ConfirmedPaymentIntent,
          () => {
            cleanup();
            this._status$.next('success');
            resolve({ paymentIntentId, stripeTag: `stripe:${paymentIntentId.slice(-12)}` });
          },
        ).then(h => { hConfirmed = h; });

        StripeTerminal.addListener(
          TerminalEventsEnum.Failed,
          (info: { message: string; code?: string; declineCode?: string }) => {
            cleanup();
            this._status$.next('connected');
            this._errorMessage$.next(info.message);
            reject(new Error(info.message));
          },
        ).then(h => { hFailed = h; });

        StripeTerminal.addListener(
          TerminalEventsEnum.Canceled,
          () => {
            cleanup();
            this._status$.next('connected');
            reject(new Error('Paiement annulé'));
          },
        ).then(h => { hCanceled = h; });

        const configureSimulator = environment.tpe_simulated
          ? StripeTerminal.setSimulatorConfiguration({ simulatedCard: SimulatedCardType.Visa, update: SimulateReaderUpdate.None })
          : Promise.resolve();

        configureSimulator
          .then(() => StripeTerminal.collectPaymentMethod({ paymentIntent: clientSecret }))
          .then(() => StripeTerminal.confirmPaymentIntent())
          .catch(err => {
            cleanup();
            this._status$.next('connected');
            this._errorMessage$.next(err?.message ?? 'Erreur collecte');
            reject(err);
          });
      });
    }

    // Electron / web
    const collectResult = await this.terminal.collectPaymentMethod(clientSecret);
    if (collectResult.error) {
      this._status$.next('connected');
      this._errorMessage$.next(collectResult.error.message);
      throw new Error(collectResult.error.message);
    }
    const processResult = await this.terminal.processPayment(collectResult.paymentIntent);
    if (processResult.error) {
      this._status$.next('connected');
      this._errorMessage$.next(processResult.error.message);
      throw new Error(processResult.error.message);
    }
    this._status$.next('success');
    const pi = processResult.paymentIntent;
    return {
      paymentIntentId: pi.id,
      stripeTag: pi.metadata?.['stripeTag'] || `stripe:${pi.id.slice(-12)}`,
    };
  }

  /**
   * Annule la collecte en cours (ex: client change d'avis).
   */
  async cancelCollect(): Promise<void> {
    if (this.isAndroid) {
      await StripeTerminal.cancelCollectPaymentMethod();
    } else {
      if (!this.terminal) return;
      await this.terminal.cancelCollectPaymentMethod();
    }
    this._status$.next('connected');
  }

  /**
   * Réinitialise le statut d'erreur ou succès (retour à l'état connecté/idle).
   */
  resetStatus(): void {
    this._errorMessage$.next('');
    this._status$.next(this.reader ? 'connected' : 'idle');
  }

  // ──────────────────────────────────────────────────────────
  // Privé
  // ──────────────────────────────────────────────────────────

  private async fetchConnectionToken(): Promise<string> {
    const authToken = await this.getAuthToken();

    const restOp = post({
      apiName: this.API_NAME,
      path: '/api/stripe/connection-token',
      options: {
        body: {} as any,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      },
    });

    const { body } = await restOp.response;
    const json = JSON.parse(await body.text());
    if (!json.secret) throw new Error('[StripeTerminal] Connection token manquant');
    return json.secret;
  }

  private async getAuthToken(): Promise<string> {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || '';
  }

  // ──────────────────────────────────────────────────────────
  // Mode distant (PC) : relay AppSync → ppTPE
  // Logique de timing et de retry centralisée ici — ne pas dupliquer.
  // ──────────────────────────────────────────────────────────

  async reserveForSale(params: SharedTpeReservationParams): Promise<string | null> {
    if (!this.sharedTpeEnabled || this._remoteStarting || this._pendingPaymentRequestId || this.remotePaymentUncertainty) {
      throw new Error('TPE indisponible ou résultat non confirmé.');
    }
    this._remoteStarting = true;
    this._sharedReservationId = crypto.randomUUID();
    this._pendingPaymentRequestId = SHARED_TPE_REQUEST_ID;
    try {
      const acquired = await this._reserveSharedRequest(this._createRemoteClient(), params, this._sharedReservationId);
      if (!acquired) {
        this._remoteStarting = false;
        this._cleanupPaymentSub();
        return null;
      }
      return this._sharedReservationId;
    } catch (error) {
      this._remoteStarting = false;
      this._markRemoteUncertain('Réservation TPE non confirmée');
      throw error;
    }
  }

  async cancelPreparedReservation(reservationId: string): Promise<void> {
    if (!this._remoteStarting || this._sharedReservationId !== reservationId || this._pendingPaymentIntentId) {
      throw new Error('Réservation TPE non annulable.');
    }
    try {
      await this._releaseSharedRequest(this._createRemoteClient(), reservationId, 'reserved');
      this._cleanupPaymentSub();
    } catch (error) {
      this._markRemoteUncertain('Libération de la réservation non confirmée');
      throw error;
    } finally {
      this._remoteStarting = false;
    }
  }

  private async _reserveSharedRequest(client: any, params: SharedTpeReservationParams, reservationId: string): Promise<boolean> {
    const reservation = {
      id: SHARED_TPE_REQUEST_ID,
      reservationId,
      origin: params.origin ?? 'shop',
      clientSecret: '',
      paymentIntentId: '',
      amountCents: params.amountCents,
      memberName: params.memberName,
      season: params.season,
      date: params.date,
      bookEntryId: params.bookEntryId ?? null,
      buyerMemberId: params.buyerMemberId ?? null,
      status: 'reserved',
    };
    let { data, errors } = await client.models.PaymentRequest.create(reservation);
    if (this._isConditionalFailure(errors)) {
      ({ data, errors } = await client.models.PaymentRequest.update(reservation, {
        condition: { status: { eq: 'available' } },
      }));
    }
    if (this._isConditionalFailure(errors)) return false;
    if (errors?.length || data?.reservationId !== reservationId) {
      throw new Error('Réservation TPE non confirmée');
    }
    return true;
  }

  /**
   * Crée le PaymentIntent + PaymentRequest AppSync, puis observe le résultat.
   * ppTPE (Android) reçoit la requête, encaisse la carte, met à jour le status.
   * Toutes les constantes de timing sont ici (timeout 30 s, observeQuery, etc.).
   */
  async startRemotePayment(
    params: {
      amountCents: number;
      memberName: string;
      memberFirstName?: string;
      buyerMemberId?: string;
      buyerEmail?: string;
      season: string;
      date: string;
      bookEntryId?: string;
      origin?: 'shop' | 'pointage' | 'ticketing';
      reservationId?: string;
    },
    callbacks: {
      /** Appelé juste après createPaymentIntent — permet de capturer le stripeTag avant la collecte. */
      onPaymentIntentCreated?: (stripeTag: string, paymentIntentId: string) => void | Promise<void>;
      /** ppTPE a pris en charge la demande (désactivation du timeout). */
      onProcessing?: () => void;
      /** Carte acceptée — le paiement est confirmé. */
      onSuccess: (paymentIntentId: string, stripeTag: string) => void;
      /** Carte refusée ou erreur Stripe. */
      onFailed: (message: string, cleanupComplete: boolean) => void;
      /** Paiement annulé (par ppTPE ou par l'utilisateur). */
      onCancelled: (cleanupComplete: boolean) => void;
      /** ppTPE ne répond pas dans les 30 s. */
      onTimeout: () => void;
      /** Résultat incertain : conserver le BookEntry et rapprocher avant nouvel essai. */
      onError: () => void;
    },
  ): Promise<void> {
    const prepared = this.sharedTpeEnabled && !!params.reservationId
      && this._remoteStarting && this._sharedReservationId === params.reservationId;
    if (params.reservationId && !prepared) {
      this._notifyRemoteError(callbacks.onError);
      return;
    }
    if (!prepared && (this._remoteStarting || this._pendingPaymentRequestId || this.remotePaymentUncertainty)) {
      this._notifyRemoteError(callbacks.onError);
      return;
    }
    this._remoteStarting = true;
    this.remotePendingAmount$.next(params.amountCents / 100);
    this._pendingBookEntryId = params.bookEntryId ?? null;

    let client: any;
    try {
      if (this.sharedTpeEnabled) {
        client = this._createRemoteClient();
        if (prepared) {
          const { data, errors } = await client.models.PaymentRequest.update(
            { id: SHARED_TPE_REQUEST_ID, bookEntryId: params.bookEntryId },
            { condition: { and: [
              { status: { eq: 'reserved' } },
              { reservationId: { eq: this._sharedReservationId } },
            ] } },
          );
          if (errors?.length || !data) throw new Error('Association comptable TPE non confirmée');
        } else {
          this._sharedReservationId = crypto.randomUUID();
          this._pendingPaymentRequestId = SHARED_TPE_REQUEST_ID;
          if (!await this._reserveSharedRequest(client, params, this._sharedReservationId)) {
            const cleaned = await this._cleanupFailedPayment(client, null, params.bookEntryId);
            this._remoteStarting = false;
            this.remotePendingAmount$.next(0);
            if (cleaned) this._cleanupPaymentSub();
            else this._markRemoteUncertain('Nettoyage de la vente non confirmé');
            callbacks.onFailed('TPE déjà utilisé par un autre poste.', cleaned);
            return;
          }
        }
      }
    } catch (error) {
      console.error('[StripeTerminal] Réservation TPE non confirmée:', error);
      this._remoteStarting = false;
      this._markRemoteUncertain('Réservation TPE non confirmée');
      this._notifyRemoteError(callbacks.onError);
      return;
    }

    // 1. Créer le PaymentIntent côté serveur
    let paymentIntent: Awaited<ReturnType<StripeTerminalService['createPaymentIntent']>>;
    try {
      paymentIntent = await this.createPaymentIntent(params);
      this._pendingPaymentIntentId = paymentIntent.paymentIntentId;
      await callbacks.onPaymentIntentCreated?.(paymentIntent.stripeTag, paymentIntent.paymentIntentId);
    } catch (error) {
      this._remoteStarting = false;
      this._markRemoteUncertain('Création du PaymentIntent ou préparation locale incertaine');
      this._notifyRemoteError(callbacks.onError);
      return;
    }
    const { clientSecret, paymentIntentId, stripeTag } = paymentIntent;
    this._pendingPaymentIntentId = paymentIntentId;

    // 2. Créer le PaymentRequest dans AppSync
    if (!client) {
      try {
        client = this._createRemoteClient();
      } catch (error) {
        this._remoteStarting = false;
        this._markRemoteUncertain('Initialisation AppSync non confirmée');
        this._notifyRemoteError(callbacks.onError);
        return;
      }
    }
    const ttl = Math.floor(Date.now() / 1000) + 86400; // purge auto 24h
    let requestId: string;
    let response: any;
    try {
      requestId = this.sharedTpeEnabled ? SHARED_TPE_REQUEST_ID : crypto.randomUUID();
      this._pendingPaymentRequestId = requestId;
      const request = {
        id: requestId,
        clientSecret,
        paymentIntentId,
        amountCents: params.amountCents,
        memberName: params.memberName,
        season: params.season,
        date: params.date,
        stripeTag,
        bookEntryId: params.bookEntryId,
        status: 'pending',
      };
      response = this.sharedTpeEnabled
        ? await client.models.PaymentRequest.update(request, {
            condition: { and: [
              { status: { eq: 'reserved' } },
              { reservationId: { eq: this._sharedReservationId } },
            ] },
          })
        : await client.models.PaymentRequest.create({ ...request, ttl });
    } catch (error) {
      this._remoteStarting = false;
      this._markRemoteUncertain('Création de la demande TPE incertaine');
      this._notifyRemoteError(callbacks.onError);
      return;
    }
    const { data, errors } = response ?? {};
    if (errors?.length || data?.id !== requestId) {
      this._remoteStarting = false;
      this._markRemoteUncertain('Création de la demande TPE non confirmée');
      this._notifyRemoteError(callbacks.onError);
      return;
    }
    this._remoteStarting = false;

    // Timeout de sécurité : si ppTPE ne passe pas en 'processing' dans les 30 s
    // c'est qu'il est inactif — annuler proprement le PaymentIntent Stripe.
    this._pendingPaymentTimeout = setTimeout(async () => {
      if (this._pendingPaymentRequestId) {
        try {
          await this.cancelRemotePayment();
          callbacks.onTimeout();
        } catch (error) {
          console.error('[StripeTerminal] Timeout cleanup failed:', error);
          this._notifyRemoteError(callbacks.onError);
        }
      }
    }, 30_000);

    // 3. observeQuery filtré sur cet ID — plus fiable que onUpdate() dont la
    //    souscription WebSocket peut manquer la mutation si elle n'est pas encore établie.
    try {
      this._paymentRequestSub = (client.models.PaymentRequest.observeQuery({
      filter: { id: { eq: data.id } },
    }) as any).subscribe({
      next: async ({ items }: any) => {
        const updated = items?.[0];
        if (!updated || this._remoteSettling ||
            (this._sharedReservationId && updated.reservationId !== this._sharedReservationId)) return;

        if (updated.status === 'processing') {
          // ppTPE a pris en charge la demande — désactiver le timeout
          this._clearPendingPaymentTimeout();
          callbacks.onProcessing?.();
          return;
        }
        if (updated.status === 'success') {
          this._remoteSettling = true;
          this._clearPendingPaymentTimeout();
          if (this._sharedReservationId) {
            try {
              await this._finishSharedRequest(client, this._sharedReservationId, 'success');
            } catch (error) {
              console.error('[StripeTerminal] Paiement confirmé, libération TPE non confirmée:', error);
            }
          }
          this._cleanupPaymentSub();
          this._remotePaymentUncertain$.next(null);
          this._remoteSettling = false;
          this.remotePendingAmount$.next(0);
          callbacks.onSuccess(paymentIntentId, stripeTag);
        } else if (updated.status === 'failed') {
          this._remoteSettling = true;
          this._clearPendingPaymentTimeout();
          let cleanupComplete = await this._cleanupFailedPayment(
            client,
            paymentIntentId,
            params.bookEntryId,
          );
          if (cleanupComplete && this._sharedReservationId) {
            try {
              await this._finishSharedRequest(client, this._sharedReservationId, 'failed');
            } catch (error) {
              console.error('[StripeTerminal] Libération TPE non confirmée:', error);
              cleanupComplete = false;
            }
          }
          if (cleanupComplete) {
            this._cleanupPaymentSub();
            this._remotePaymentUncertain$.next(null);
          } else {
            this._stopPaymentSubscription();
            this._markRemoteUncertain('Échec TPE : annulation Stripe ou nettoyage non confirmé');
          }
          this._remoteSettling = false;
          this.remotePendingAmount$.next(0);
          callbacks.onFailed(
            updated.errorMessage || 'Paiement refusé par le TPE',
            cleanupComplete,
          );
        } else if (updated.status === 'cancelled') {
          this._remoteSettling = true;
          this._clearPendingPaymentTimeout();
          let cleanupComplete = await this._cleanupFailedPayment(
            client,
            paymentIntentId,
            params.bookEntryId,
          );
          if (cleanupComplete && this._sharedReservationId) {
            try {
              await this._finishSharedRequest(client, this._sharedReservationId, 'cancelled');
            } catch (error) {
              console.error('[StripeTerminal] Libération TPE non confirmée:', error);
              cleanupComplete = false;
            }
          }
          if (cleanupComplete) {
            this._cleanupPaymentSub();
            this._remotePaymentUncertain$.next(null);
          } else {
            this._stopPaymentSubscription();
            this._markRemoteUncertain('Annulation Stripe ou nettoyage non confirmé');
          }
          this._remoteSettling = false;
          this.remotePendingAmount$.next(0);
          callbacks.onCancelled(cleanupComplete);
        }
      },
      error: () => {
        this._clearPendingPaymentTimeout();
        this._markRemoteUncertain('Connexion AppSync perdue pendant le paiement');
        this.remotePendingAmount$.next(0);
        this._notifyRemoteError(callbacks.onError);
      },
      });
      if (this._sharedReservationId) {
        const reservationId = this._sharedReservationId;
        const resultSub = client.models.TPEPaymentResult.observeQuery({
          filter: { id: { eq: reservationId } },
        }).subscribe({
          next: ({ items }: { items: Array<{ id: string; status: string; paymentIntentId: string }> }) => {
            const result = items?.[0];
            if (!result || result.id !== reservationId || result.paymentIntentId !== paymentIntentId
                || this._sharedReservationId !== reservationId || this._remoteSettling) return;
            if (result.status !== 'success' && result.status !== 'failed' && result.status !== 'cancelled') return;
            this._clearPendingPaymentTimeout();
            this._cleanupPaymentSub();
            this._remotePaymentUncertain$.next(null);
            this.remotePendingAmount$.next(0);
            if (result.status === 'success') callbacks.onSuccess(paymentIntentId, stripeTag);
            else if (result.status === 'failed') callbacks.onFailed('Paiement refusé par le TPE.', true);
            else callbacks.onCancelled(true);
          },
          error: (error: unknown) => console.error('[StripeTerminal] Observation du résultat TPE impossible:', error),
        });
        if (this._sharedReservationId === reservationId) this._sharedResultSub = resultSub;
        else resultSub.unsubscribe();
      }
    } catch (error) {
      this._clearPendingPaymentTimeout();
      this._markRemoteUncertain('Observation de la demande TPE impossible');
      this._notifyRemoteError(callbacks.onError);
    }
  }

  /**
   * Annule le PaymentRequest en attente et réinitialise l'état.
   * Échoue sans nettoyage si la demande a déjà été prise en charge ou est incertaine.
   */
  async cancelRemotePayment(): Promise<void> {
    if (this._remoteStarting || this._remoteSettling || this.remotePaymentUncertainty) {
      throw new Error('Paiement en cours ou résultat incertain — rapprochement nécessaire');
    }
    this._clearPendingPaymentTimeout();

    const prId = this._pendingPaymentRequestId;
    const piId = this._pendingPaymentIntentId;
    const bookEntryId = this._pendingBookEntryId;
    const client = generateClient<Schema>() as any;
    if (prId) {
      this._remoteSettling = true;
      try {
        await this._cancelPendingRequest(client, prId);
      } catch (error) {
        this._remoteSettling = false;
        this._markRemoteUncertain('Demande déjà prise en charge ou annulation non confirmée');
        throw error;
      }
    }
    let cleanupComplete = await this._cleanupFailedPayment(client, piId, bookEntryId);
    if (cleanupComplete && this._sharedReservationId) {
      try {
        await this._finishSharedRequest(client, this._sharedReservationId, 'cancelled');
      } catch (error) {
        console.error('[StripeTerminal] Libération TPE non confirmée:', error);
        cleanupComplete = false;
      }
    }
    this._remoteSettling = false;
    if (!cleanupComplete) {
      this._markRemoteUncertain('Annulation Stripe ou nettoyage non confirmé');
      throw new Error('Annulation ou nettoyage non confirmé — rapprochement nécessaire');
    }
    this._cleanupPaymentSub();
    this._remotePaymentUncertain$.next(null);
    this.remotePendingAmount$.next(0);
  }

  private _createRemoteClient(): any {
    return generateClient<Schema>() as any;
  }

  observeSharedTpe(): void {
    if (!this.sharedTpeEnabled || this._sharedStateSub) return;
    try {
      const client = this._createRemoteClient();
      this._sharedStateSub = client.models.PaymentRequest.observeQuery({
        filter: { id: { eq: SHARED_TPE_REQUEST_ID } },
      }).subscribe({
        next: ({ items, isSynced }: { items: SharedTpeRequest[]; isSynced: boolean }) => {
          this.sharedRequest$.next(isSynced ? items[0] ?? null : undefined);
        },
        error: (error: unknown) => {
          console.error('[StripeTerminal] État TPE partagé indisponible:', error);
          this.sharedRequest$.next(undefined);
          this._sharedStateSub = null;
        },
      });
    } catch (error) {
      console.error('[StripeTerminal] Observation TPE partagé impossible:', error);
      this.sharedRequest$.next(undefined);
    }
  }

  retrySharedTpeObservation(): void {
    this._sharedStateSub?.unsubscribe();
    this._sharedStateSub = null;
    this.sharedRequest$.next(undefined);
    this.observeSharedTpe();
  }

  async getSharedTpeResult(reservationId: string): Promise<SharedTpeResult | null> {
    const client = this._createRemoteClient();
    const { data, errors } = await client.models.TPEPaymentResult.get({ id: reservationId });
    if (errors?.length) throw new Error('Résultat TPE indisponible.');
    if (!data) return null;
    if (data.reservationId !== reservationId || !data.paymentIntentId
        || !['success', 'failed', 'cancelled'].includes(data.status)) {
      throw new Error('Résultat TPE incohérent.');
    }
    return data;
  }

  async reconcileSharedTpe(cancelPending = false): Promise<'success' | 'cancelled'> {
    if (!this.sharedTpeEnabled) throw new Error('Partage TPE désactivé.');
    if ((this._pendingPaymentRequestId && !this.remotePaymentUncertainty)
        || this._remoteStarting || this._remoteSettling) {
      throw new Error('Ce poste suit déjà un paiement. Utilisez son bouton d’annulation.');
    }
    const client = this._createRemoteClient();
    const { data: request, errors } = await client.models.PaymentRequest.get({ id: SHARED_TPE_REQUEST_ID });
    if (errors?.length || !request?.reservationId) {
      throw new Error('Réservation TPE introuvable ou impossible à vérifier.');
    }
    let status = request.status;
    if (status === 'pending' && cancelPending) {
      const response = await client.models.PaymentRequest.update(
        { id: SHARED_TPE_REQUEST_ID, status: 'cancelled' },
        { condition: { and: [
          { status: { eq: 'pending' } },
          { reservationId: { eq: request.reservationId } },
        ] } },
      );
      if (response.errors?.length || !response.data) {
        throw new Error('La demande a changé : actualisez son état avant de réessayer.');
      }
      status = 'cancelled';
    }
    if (status === 'success') {
      await this._finishSharedRequest(client, request.reservationId, status);
      this._clearRecoveredUncertainty(request.reservationId);
      return 'success';
    }
    if (status !== 'failed' && status !== 'cancelled') {
      throw new Error('Paiement encore en cours ou résultat incertain : contactez un responsable.');
    }
    if (!request.paymentIntentId) {
      throw new Error('Identifiant Stripe inconnu : rapprochement manuel nécessaire.');
    }
    if (!await this._cleanupFailedPayment(client, request.paymentIntentId, request.bookEntryId)) {
      throw new Error('Annulation Stripe ou nettoyage non confirmé : le TPE reste bloqué.');
    }
    await this._finishSharedRequest(client, request.reservationId, status);
    this._clearRecoveredUncertainty(request.reservationId);
    return 'cancelled';
  }

  private _clearRecoveredUncertainty(reservationId: string): void {
    if (this.remotePaymentUncertainty && this._sharedReservationId === reservationId) {
      this._cleanupPaymentSub();
      this._remotePaymentUncertain$.next(null);
      this.remotePendingAmount$.next(0);
    }
  }

  private async _finishSharedRequest(
    client: any, reservationId: string, status: 'success' | 'failed' | 'cancelled',
  ): Promise<void> {
    const current = await client.models.PaymentRequest.get({ id: SHARED_TPE_REQUEST_ID });
    if (current.errors?.length || !current.data) throw new Error('Résultat TPE non vérifié.');
    const request = current.data;
    if (request.reservationId !== reservationId) {
      const previous = await client.models.TPEPaymentResult.get({ id: reservationId });
      if (previous.errors?.length || previous.data?.status !== status) {
        throw new Error('Résultat TPE archivé introuvable.');
      }
      return;
    }
    if (request.status !== status || !request.paymentIntentId) throw new Error('Résultat TPE non confirmé.');
    const record = {
      id: reservationId,
      reservationId,
      origin: request.origin,
      status,
      paymentIntentId: request.paymentIntentId,
      bookEntryId: request.bookEntryId,
      buyerMemberId: request.buyerMemberId,
    };
    const saved = await client.models.TPEPaymentResult.create(record);
    if (this._isConditionalFailure(saved.errors)) {
      const existing = await client.models.TPEPaymentResult.get({ id: reservationId });
      if (existing.errors?.length || existing.data?.status !== status
          || existing.data?.paymentIntentId !== request.paymentIntentId
          || (existing.data?.bookEntryId ?? null) !== (request.bookEntryId ?? null)
          || (existing.data?.buyerMemberId ?? null) !== (request.buyerMemberId ?? null)) {
        throw new Error('Résultat TPE archivé incohérent.');
      }
    } else if (saved.errors?.length || saved.data?.id !== reservationId) {
      throw new Error('Archivage du résultat TPE non confirmé.');
    }
    await this._releaseSharedRequest(client, reservationId, status);
  }

  private async _releaseSharedRequest(client: any, reservationId: string, status: string): Promise<void> {
    const { data, errors } = await client.models.PaymentRequest.update(
      { id: SHARED_TPE_REQUEST_ID, status: 'available', reservationId: null,
        clientSecret: '', paymentIntentId: '', bookEntryId: null, buyerMemberId: null,
        stripeTag: null, errorMessage: null, memberName: '', amountCents: 0 },
      { condition: { and: [
        { reservationId: { eq: reservationId } },
        { status: { eq: status } },
      ] } },
    );
    if (errors?.length || !data) {
      const current = await client.models.PaymentRequest.get({ id: SHARED_TPE_REQUEST_ID });
      if (current.errors?.length || !current.data || current.data.reservationId === reservationId) {
        throw new Error('Libération TPE non confirmée.');
      }
    }
  }

  private _isConditionalFailure(errors: { errorType?: string }[] | undefined): boolean {
    return !!errors?.length && errors.every(error => error.errorType?.includes('ConditionalCheckFailed'));
  }

  private _notifyRemoteError(callback: () => void): void {
    try {
      callback();
    } catch (error) {
      console.error('[StripeTerminal] Callback d’erreur échoué:', error);
    }
  }

  private async _cancelPendingRequest(client: any, id: string): Promise<void> {
    const condition = this._sharedReservationId
      ? { and: [{ status: { eq: 'pending' } }, { reservationId: { eq: this._sharedReservationId } }] }
      : { status: { eq: 'pending' } };
    const { data, errors } = await client.models.PaymentRequest.update(
      { id, status: 'cancelled' },
      { condition },
    );
    if (errors?.length || !data) {
      throw new Error('Demande TPE non annulée : prise en charge ou résultat incertain');
    }
  }

  private _markRemoteUncertain(reason: string): void {
    this._remotePaymentUncertain$.next({
      reason,
      paymentRequestId: this._pendingPaymentRequestId,
      paymentIntentId: this._pendingPaymentIntentId,
      bookEntryId: this._pendingBookEntryId,
    });
  }

  private async _cleanupFailedPayment(
    client: any,
    paymentIntentId?: string | null,
    bookEntryId?: string | null,
  ): Promise<boolean> {
    try {
      if (paymentIntentId) {
        await this.cancelPaymentIntent(paymentIntentId);
      }
      if (bookEntryId) {
        if (paymentIntentId && this.sharedTpeEnabled) {
          await this.deletePendingBookEntry(bookEntryId, paymentIntentId);
        } else {
          const { errors } = await client.models.BookEntry.delete({ id: bookEntryId });
          if (errors?.length) throw new Error('Nettoyage de la vente non confirmé');
        }
      }
      return true;
    } catch (error) {
      console.error('[StripeTerminal] Failed payment cleanup incomplete:', {
        paymentIntentId,
        bookEntryId,
        error,
      });
      return false;
    }
  }

  private _clearPendingPaymentTimeout(): void {
    if (this._pendingPaymentTimeout !== null) {
      clearTimeout(this._pendingPaymentTimeout);
      this._pendingPaymentTimeout = null;
    }
  }

  private _cleanupPaymentSub(): void {
    this._stopPaymentSubscription();
    this._pendingPaymentRequestId = null;
    this._pendingPaymentIntentId = null;
    this._pendingBookEntryId = null;
    this._sharedReservationId = null;
  }

  private _stopPaymentSubscription(): void {
    this._paymentRequestSub?.unsubscribe();
    this._paymentRequestSub = null;
    this._sharedResultSub?.unsubscribe();
    this._sharedResultSub = null;
  }
}
