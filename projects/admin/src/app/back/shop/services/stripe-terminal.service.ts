/**
 * StripeTerminalService
 * Gestion du lecteur TPE physique via le SDK Stripe Terminal JS.
 *
 * Flux:
 * 1. init()              — charge le SDK (une seule fois par session navigateur)
 * 2. discoverReaders()   — liste les readers Bluetooth disponibles
 * 3. connectReader()     — appaire un reader
 * 4. createPaymentIntent() — crée un PaymentIntent côté serveur (Lambda)
 * 5. collectAndProcess() — SDK collecte la carte et traite le paiement
 * 6. disconnectReader()  — libère le reader
 *
 * Contrainte navigateur : Web Bluetooth API → Chrome/Edge uniquement.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';

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

  // ──────────────────────────────────────────────────────────
  // Initialisation
  // ──────────────────────────────────────────────────────────

  /**
   * Charge le SDK Stripe Terminal (une seule fois) et crée l'instance.
   * Doit être appelé avant toute autre opération Terminal.
   */
  async init(): Promise<void> {
    if (this.terminal) return;

    const { loadStripeTerminal } = await import('@stripe/terminal-js');
    const StripeTerminal = await loadStripeTerminal();
    if (!StripeTerminal) throw new Error('[StripeTerminal] Impossible de charger le SDK (vérifiez la connexion réseau)');

    this.terminal = StripeTerminal.create({
      onFetchConnectionToken: () => this.fetchConnectionToken(),
      onUnexpectedReaderDisconnect: () => {
        console.warn('[StripeTerminal] Reader disconnected unexpectedly — Bluetooth perdu');
        this.reader = null;
        this._status$.next('disconnected');
        this._readerLabel$.next('');
        // Signal UI : l'utilisateur peut relancer onConnectReader() pour re-scanner
      },
    });
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

    const isBluetooth = reader.device_type === 'bbpos_wisepad3'
      || (reader as any).discoveryMethod === 'bluetooth'
      || (!reader.ip_address && !reader.base_url);

    const connectFn = isBluetooth
      ? () => (this.terminal as any).connectBluetoothReader(reader, {
          fail_if_in_use: false,
          // Reconnexion automatique si déconnexion inattendue
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
    if (!this.terminal || !this.reader) return;
    await this.terminal.disconnectReader();
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

    // Étape 1 : collecte de la carte (appui sur le TPE par le client)
    const collectResult = await this.terminal.collectPaymentMethod(clientSecret);
    if (collectResult.error) {
      this._status$.next('connected');
      this._errorMessage$.next(collectResult.error.message);
      throw new Error(collectResult.error.message);
    }

    // Étape 2 : traitement du paiement
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
    if (!this.terminal) return;
    await this.terminal.cancelCollectPaymentMethod();
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
