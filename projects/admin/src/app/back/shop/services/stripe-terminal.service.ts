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
      StripeTerminal.initialize({ isTest: true });
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
    buyerMemberId?: string;
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
}
