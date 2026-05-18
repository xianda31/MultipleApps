import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Amplify } from 'aws-amplify';
import { getCurrentUser, signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { post } from 'aws-amplify/api';
import {
  StripeTerminal,
  TerminalConnectTypes,
  TerminalEventsEnum,
  SimulatedCardType,
  SimulateReaderUpdate,
  type ReaderInterface,
} from '@capacitor-community/stripe-terminal';
import outputs from '../../../../amplify_outputs.json';
import { environment } from '../environments/environment';
import type { Schema } from '../../../../amplify/data/resource';

type AppState = 'checking-auth' | 'login' | 'scanning' | 'connected' | 'processing' | 'error';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  state: AppState = 'checking-auth';
  readerLabel = '';
  currentMemberName = '';
  currentAmountCents = 0;
  errorMessage = '';
  loginEmail = '';
  loginPassword = '';
  loginError = '';
  loginLoading = false;

  private client!: ReturnType<typeof generateClient<Schema>>;
  private tpeSessionId: string | null = null;
  private paymentRequestSub: any = null;
  private capacitorInitialized = false;
  private readonly processedPaymentIds = new Set<string>();

  // ──────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────

  ngOnInit(): void {
    Amplify.configure(outputs);

    // Enregistrer les API REST custom (custom.API → API.REST) comme dans admin/main.ts
    const amplifyConfig = Amplify.getConfig();
    const restApi = Object.fromEntries(
      Object.entries(outputs.custom['API'] as Record<string, any>).map(([name, cfg]) => [
        name,
        { ...cfg, endpoint: (cfg.endpoint as string).replace(/\/$/, '') },
      ]),
    );
    Amplify.configure(
      { ...amplifyConfig, API: { ...amplifyConfig.API, REST: restApi } },
      {
        API: {
          REST: {
            headers: async () => {
              const session = await fetchAuthSession();
              return {
                Authorization: session.tokens?.idToken
                  ? session.tokens.idToken.toString()
                  : '',
              };
            },
          },
        },
      },
    );

    this.client = generateClient<Schema>();
    this.checkAuth();
  }

  ngOnDestroy(): void {
    this.paymentRequestSub?.unsubscribe();
  }

  // ──────────────────────────────────────────────────────────
  // Auth
  // ──────────────────────────────────────────────────────────

  private async checkAuth(): Promise<void> {
    try {
      const user = await getCurrentUser();
      this.tpeSessionId = user.userId; // ID déterministe = 1 session par user
      await this.startTPE();
    } catch {
      this.state = 'login';
    }
  }

  async onLogin(): Promise<void> {
    this.loginError = '';
    this.loginLoading = true;
    try {
      await signIn({ username: this.loginEmail, password: this.loginPassword });
      const user = await getCurrentUser();
      this.tpeSessionId = user.userId;
      await this.startTPE();
    } catch (e: any) {
      this.loginError = e.message || 'Identifiants incorrects';
    } finally {
      this.loginLoading = false;
    }
  }

  async onSignOut(): Promise<void> {
    this.paymentRequestSub?.unsubscribe();
    this.paymentRequestSub = null;
    await this.upsertTPESession('disconnected', '');
    await StripeTerminal.disconnectReader().catch(() => {});
    await signOut();
    this.state = 'login';
    this.readerLabel = '';
    this.tpeSessionId = null;
    this.capacitorInitialized = false;
    this.processedPaymentIds.clear();
  }

  // ──────────────────────────────────────────────────────────
  // TPE — initialisation et connexion BLE
  // ──────────────────────────────────────────────────────────

  private async startTPE(): Promise<void> {
    this.state = 'scanning';
    this.errorMessage = '';
    try {
      await this.initCapacitor();
      await this.upsertTPESession('scanning', '');

      const readers = await this.discoverReaders();
      if (readers.length === 0) {
        this.errorMessage = 'Aucun lecteur trouvé (15s). Vérifiez que le WisePad 3 est allumé et à portée Bluetooth.';
        this.state = 'error';
        await this.upsertTPESession('disconnected', '');
        return;
      }

      await StripeTerminal.connectReader({
        reader: readers[0],
        autoReconnectOnUnexpectedDisconnect: true,
      });
      this.readerLabel = this.friendlyReaderLabel(readers[0]);
      this.state = 'connected';
      await this.upsertTPESession('connected', this.readerLabel);
      this.subscribePaymentRequests();

    } catch (e: any) {
      this.errorMessage = e.message || 'Erreur initialisation TPE';
      this.state = 'error';
      await this.upsertTPESession('disconnected', '');
    }
  }

  private async initCapacitor(): Promise<void> {
    if (this.capacitorInitialized) return;

    await StripeTerminal.addListener(TerminalEventsEnum.RequestedConnectionToken, async () => {
      try {
        const token = await this.fetchConnectionToken();
        await StripeTerminal.setConnectionToken({ token });
      } catch (e: any) {
        console.error('[ppTPE] fetchConnectionToken error:', e?.message);
      }
    });

    await StripeTerminal.addListener(TerminalEventsEnum.UnexpectedReaderDisconnect, async () => {
      this.readerLabel = '';
      this.paymentRequestSub?.unsubscribe();
      this.paymentRequestSub = null;
      await this.upsertTPESession('disconnected', '');
      this.state = 'scanning';
      setTimeout(() => this.startTPE(), 3000);
    });

    await new Promise<void>((resolve) => {
      StripeTerminal.addListener(TerminalEventsEnum.Loaded, () => resolve());
      StripeTerminal.initialize({ isTest: environment.tpe_isTest });
    });

    this.capacitorInitialized = true;
  }

  private async discoverReaders(): Promise<ReaderInterface[]> {
    return new Promise<ReaderInterface[]>((resolve) => {
      let handle: any;

      const timer = setTimeout(() => {
        handle?.remove();
        StripeTerminal.cancelDiscoverReaders().catch(() => {});
        resolve([]);
      }, 15000);

      StripeTerminal.addListener(TerminalEventsEnum.DiscoveredReaders, ({ readers }) => {
        clearTimeout(timer);
        handle?.remove();
        StripeTerminal.cancelDiscoverReaders().catch(() => {});
        resolve(readers ?? []);
      }).then((h) => { handle = h; });

      if (environment.tpe_simulated) {
        StripeTerminal.setSimulatorConfiguration({
          simulatedCard: SimulatedCardType.Visa,
          update: SimulateReaderUpdate.None,
        }).catch(() => {});
      }

      StripeTerminal.discoverReaders({
        type: environment.tpe_simulated
          ? TerminalConnectTypes.Internet
          : TerminalConnectTypes.Bluetooth,
        locationId: environment.tpe_location_id,
      }).catch(() => {});
    });
  }

  async onRetry(): Promise<void> {
    this.errorMessage = '';
    await this.startTPE();
  }

  // ──────────────────────────────────────────────────────────
  // PaymentRequest — relay AppSync → TPE
  // ──────────────────────────────────────────────────────────

  private subscribePaymentRequests(): void {
    this.paymentRequestSub?.unsubscribe();
    // observeQuery = état initial + mises à jour temps réel
    this.paymentRequestSub = (this.client.models.PaymentRequest.observeQuery() as any).subscribe({
      next: ({ items }: any) => {
        const pending = items.find(
          (pr: any) => pr.status === 'pending' && !this.processedPaymentIds.has(pr.id),
        );
        if (pending) {
          this.handlePaymentRequest(pending);
        }
      },
      error: (e: any) => console.warn('[ppTPE] PaymentRequest subscription error:', e?.message),
    });
  }

  private async handlePaymentRequest(pr: any): Promise<void> {
    // Marquer immédiatement pour éviter le double-traitement
    this.processedPaymentIds.add(pr.id);
    this.currentMemberName = pr.memberName;
    this.currentAmountCents = pr.amountCents;
    this.state = 'processing';

    try {
      await this.client.models.PaymentRequest.update({ id: pr.id, status: 'processing' } as any);

      // Utiliser la chaîne de Promises directement — plus fiable que les événements
      // ConfirmedPaymentIntent (Capacitor addListener est async, risque de race condition)
      await StripeTerminal.collectPaymentMethod({ paymentIntent: pr.clientSecret });
      await StripeTerminal.confirmPaymentIntent();

      const { errors } = await (this.client.models.PaymentRequest.update({ id: pr.id, status: 'success' } as any) as any);
      if (errors?.length) {
        console.error('[ppTPE] update success error:', JSON.stringify(errors));
      } else {
        console.log('[ppTPE] Paiement confirmé — PaymentRequest mis à jour success');
      }

    } catch (e: any) {
      const msg: string = e?.message ?? 'Erreur TPE';
      console.warn('[ppTPE] handlePaymentRequest error:', msg);
      const isCancelled = /annul|cancel/i.test(msg);
      await this.client.models.PaymentRequest.update({
        id: pr.id,
        status: isCancelled ? 'cancelled' : 'failed',
        errorMessage: msg,
      } as any).catch(() => {});
    } finally {
      this.state = 'connected';
      this.currentMemberName = '';
      this.currentAmountCents = 0;
    }
  }

  // ──────────────────────────────────────────────────────────
  // TPESession AppSync
  // ──────────────────────────────────────────────────────────

  private async upsertTPESession(
    status: 'scanning' | 'connected' | 'disconnected',
    label: string,
  ): Promise<void> {
    if (!this.tpeSessionId) return;
    const ttl = Math.floor(Date.now() / 1000) + 3600;
    const payload = { id: this.tpeSessionId, status, readerLabel: label, ttl };
    try {
      // Tente une mise à jour (record existant)
      await this.client.models.TPESession.update(payload as any);
    } catch {
      // Première fois : crée avec l'ID fixe
      try {
        await this.client.models.TPESession.create(payload as any);
      } catch (e: any) {
        console.warn('[ppTPE] TPESession upsert error:', e?.message);
      }
    }
  }

  /** Traduit le deviceType Stripe en libellé lisible. */
  private friendlyReaderLabel(reader: ReaderInterface): string {
    const dt = (reader as any).deviceType as string ?? '';
    const map: Record<string, string> = {
      chipper2X: 'WisePad 3', chipper2x: 'WisePad 3', wisepad3: 'WisePad 3',
      stripeS700: 'Stripe S700', wisePosE: 'WisePOS E',
    };
    return map[dt] ?? reader.label ?? reader.serialNumber ?? 'TPE';
  }

  // ──────────────────────────────────────────────────────────
  // Stripe connection token
  // ──────────────────────────────────────────────────────────

  private async fetchConnectionToken(): Promise<string> {
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();
    if (!token) throw new Error('No auth token');
    const restOp = post({
      apiName: 'ffbProxyApi',
      path: '/api/stripe/connection-token',
      options: {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: {} as any,
      },
    });
    const { body } = await restOp.response;
    const json = JSON.parse(await body.text());
    return json.secret;
  }
}
