import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
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
  ConnectionStatus,
  SimulatedCardType,
  SimulateReaderUpdate,
  type ReaderInterface,
} from '@capacitor-community/stripe-terminal';
import outputs from '../../../../amplify_outputs.json';
import { environment } from '../environments/environment';
import type { Schema } from '../../../../amplify/data/resource';

type AppState = 'checking-auth' | 'login' | 'scanning' | 'connecting' | 'connected' | 'processing' | 'error';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  state: AppState = 'checking-auth';
  readerLabel = '';
  firmwareProgress = 0;
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
  private heartbeatInterval: any = null;
  private resumeWatchdog: any = null;
  private tpeStarting = false;

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
    this.stopHeartbeat();
    this.clearResumeWatchdog();
    // Fermeture propre : marquer la session comme déconnectée
    this.upsertTPESession('disconnected', '').catch(() => {});
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
    this.stopHeartbeat();
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
    if (this.tpeStarting) return; // évite les démarrages simultanés
    this.tpeStarting = true;
    this.state = 'scanning';
    this.errorMessage = '';
    try {
      await this.initCapacitor();
      await this.upsertTPESession('scanning', '');

      const readers = await this.discoverReaders();
      if (readers.length === 0) {
        this.errorMessage = 'Aucun lecteur trouvé (30s). Vérifiez que le WisePad 3 est allumé et à portée Bluetooth.';
        this.state = 'error';
        await this.upsertTPESession('disconnected', '');
        return;
      }

      this.state = 'connecting';
      this.readerLabel = this.friendlyReaderLabel(readers[0]);

      const connectTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout connexion lecteur (15 min)')), 900000)
      );
      await Promise.race([
        StripeTerminal.connectReader({
          reader: readers[0],
          autoReconnectOnUnexpectedDisconnect: true,
        }),
        connectTimeout,
      ]);
      this.state = 'connected';
      await this.upsertTPESession('connected', this.readerLabel);
      this.startHeartbeat();
      this.subscribePaymentRequests();

    } catch (e: any) {
      this.errorMessage = e.message || 'Erreur initialisation TPE';
      this.state = 'error';
      await this.upsertTPESession('disconnected', '');
    } finally {
      this.tpeStarting = false;
    }
  }

  private async initCapacitor(): Promise<void> {
    if (this.capacitorInitialized) return;

    await StripeTerminal.addListener(TerminalEventsEnum.RequestedConnectionToken, async () => {
      console.log('[ppTPE] RequestedConnectionToken fired — fetching token...');
      try {
        const token = await this.fetchConnectionToken();
        console.log('[ppTPE] Connection token fetched OK, longueur:', token?.length);
        await StripeTerminal.setConnectionToken({ token });
      } catch (e: any) {
        console.error('[ppTPE] fetchConnectionToken ERREUR:', e?.message);
        await StripeTerminal.setConnectionToken({ token: '' });
      }
    });

    await StripeTerminal.addListener(TerminalEventsEnum.UnexpectedReaderDisconnect, async () => {
      this.stopHeartbeat();
      this.readerLabel = '';
      this.paymentRequestSub?.unsubscribe();
      this.paymentRequestSub = null;
      await this.upsertTPESession('disconnected', '');
      this.state = 'scanning';
      setTimeout(() => this.startTPE(), 3000);
    });

    // Auto-reconnect BLE échoué → reprendre le scan
    await StripeTerminal.addListener(TerminalEventsEnum.ReaderReconnectFailed, async () => {
      console.warn('[ppTPE] ReaderReconnectFailed — reprise du scan');
      this.stopHeartbeat();
      this.readerLabel = '';
      this.paymentRequestSub?.unsubscribe();
      this.paymentRequestSub = null;
      await this.upsertTPESession('disconnected', '');
      this.state = 'scanning';
      setTimeout(() => this.startTPE(), 3000);
    });

    // Reconnect BLE lancé → stopper le heartbeat immédiatement
    // L'admin détecte la staleness dans les ~3 min sans attendre la fin du cycle de reconnect
    await StripeTerminal.addListener(TerminalEventsEnum.ReaderReconnectStarted, async () => {
      console.warn('[ppTPE] ReaderReconnectStarted — heartbeat suspendu');
      this.stopHeartbeat();
      await this.upsertTPESession('scanning', '');
    });

    // Reconnect BLE réussi → reprendre le heartbeat
    await StripeTerminal.addListener(TerminalEventsEnum.ReaderReconnectSucceeded, async () => {
      console.log('[ppTPE] ReaderReconnectSucceeded — heartbeat repris');
      await this.upsertTPESession('connected', this.readerLabel);
      this.startHeartbeat();
    });

    await StripeTerminal.addListener(TerminalEventsEnum.StartInstallingUpdate, () => {
      console.log('[ppTPE] Mise à jour firmware WisePad 3 démarrée');
      this.firmwareProgress = 0;
      this.cdr.detectChanges();
    });

    await StripeTerminal.addListener(TerminalEventsEnum.ReaderSoftwareUpdateProgress, ({ progress }) => {
      this.firmwareProgress = Math.round((progress ?? 0) * 100);
      this.cdr.detectChanges();
    });

    await StripeTerminal.addListener(TerminalEventsEnum.FinishInstallingUpdate, () => {
      console.log('[ppTPE] Mise à jour firmware WisePad 3 terminée');
      this.firmwareProgress = 0;
    });

    // Changement d'état BLE → source de vérité pour la détection de déconnexion
    // (cet événement est délivré au réveil de veille, couvrant le cas background)
    await StripeTerminal.addListener(TerminalEventsEnum.ConnectionStatusChange, async ({ status }) => {
      console.log('[ppTPE] ConnectionStatusChange:', status);
      if (status === ConnectionStatus.NotConnected) {
        this.clearResumeWatchdog();
        if (this.state === 'connected' || this.state === 'processing') {
          console.warn('[ppTPE] ConnectionStatus NOT_CONNECTED → forcer reconnexion');
          this.stopHeartbeat();
          this.readerLabel = '';
          this.paymentRequestSub?.unsubscribe();
          this.paymentRequestSub = null;
          await this.upsertTPESession('scanning', '');
          this.state = 'scanning';
          setTimeout(() => this.startTPE(), 3000);
        }
      } else if (status === ConnectionStatus.Connected) {
        // Confirme la connexion BLE (y compris après réveil de veille)
        this.clearResumeWatchdog();
        if (this.state === 'connected' || this.state === 'processing') {
          this.startHeartbeat(); // redémarre le timer suspendu pendant la veille
        }
      }
    });

    // Watchdog au réveil : si aucun ConnectionStatus(Connected) dans les 5s → forcer reconnexion
    // Couvre le cas où les events SDK ont été perdus pendant la mise en veille Android
    document.addEventListener('resume', () => {
      if (this.state === 'connected' || this.state === 'processing') {
        console.warn('[ppTPE] App resumed — watchdog BLE 5s démarré');
        this.clearResumeWatchdog();
        this.resumeWatchdog = setTimeout(async () => {
          if (this.state === 'connected' || this.state === 'processing') {
            console.warn('[ppTPE] Watchdog: aucune confirmation BLE → forcer reconnexion');
            this.stopHeartbeat();
            this.readerLabel = '';
            this.paymentRequestSub?.unsubscribe();
            this.paymentRequestSub = null;
            await this.upsertTPESession('scanning', '');
            this.state = 'scanning';
            setTimeout(() => this.startTPE(), 500);
          }
        }, 5000);
      }
    });

    await new Promise<void>((resolve) => {
      StripeTerminal.addListener(TerminalEventsEnum.Loaded, () => {
        console.log('[ppTPE] StripeTerminal Loaded — SDK initialisé (isTest:', environment.tpe_isTest, ')');
        resolve();
      });
      console.log('[ppTPE] StripeTerminal.initialize() appelé (isTest:', environment.tpe_isTest, ')');
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
        console.warn('[ppTPE] discoverReaders: timeout 30s — aucun lecteur BLE détecté');
        resolve([]);
      }, 30000);

      StripeTerminal.addListener(TerminalEventsEnum.DiscoveredReaders, ({ readers }) => {
        console.log('[ppTPE] DiscoveredReaders event reçu, lecteurs bruts:', JSON.stringify(readers));
        const candidates = (readers ?? []).filter(r =>
          environment.tpe_simulated ? true : !r.simulated
        );
        if (candidates.length === 0) {
          // Continuer le scan : seulement des simulateurs trouvés pour l'instant
          console.log('[ppTPE] DiscoveredReaders: lecteurs simulés ignorés, attente du WisePad 3...');
          return;
        }
        clearTimeout(timer);
        handle?.remove();
        StripeTerminal.cancelDiscoverReaders().catch(() => {}).finally(() => resolve(candidates));
      }).then((h) => { handle = h; });

      if (environment.tpe_simulated) {
        StripeTerminal.setSimulatorConfiguration({
          simulatedCard: SimulatedCardType.Visa,
          update: SimulateReaderUpdate.None,
        }).catch(() => {});
      }

      const discoverOpts: any = {
        type: environment.tpe_simulated
          ? TerminalConnectTypes.Internet
          : TerminalConnectTypes.Bluetooth,
        locationId: environment.tpe_location_id,
      };
      console.log('[ppTPE] discoverReaders appelé avec options:', JSON.stringify(discoverOpts));

      // Vérification permission localisation (requise pour BLE physique sur Android < 12)
      if ('permissions' in navigator) {
        (navigator as any).permissions.query({ name: 'geolocation' }).then((r: any) => {
          console.log('[ppTPE] Permission geolocation état:', r.state); // granted / denied / prompt
        }).catch(() => {});
      }

      StripeTerminal.discoverReaders(discoverOpts).catch((e: any) => {
        console.error('[ppTPE] discoverReaders ERREUR:', e?.message);
      });
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
  // Heartbeat TTL — maintient la session "fraîche" toutes les 3 min
  // Permet à l'admin de détecter la perte de ppTPE en ≤ 3 min
  // ──────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.state === 'connected' || this.state === 'processing') {
        this.upsertTPESession('connected', this.readerLabel).catch(() => {});
      }
    }, 15 * 1000); // toutes les 15 secondes
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private clearResumeWatchdog(): void {
    if (this.resumeWatchdog !== null) {
      clearTimeout(this.resumeWatchdog);
      this.resumeWatchdog = null;
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
      // update() ne throw PAS en Amplify Gen2 si le record n'existe pas :
      // il retourne { errors } silencieusement → on vérifie explicitement
      const { errors } = await (this.client.models.TPESession.update(payload as any) as any);
      if (errors?.length) {
        // Record inexistant (purgé par DynamoDB TTL ou première utilisation)
        await (this.client.models.TPESession.create(payload as any) as any);
      }
    } catch (e: any) {
      console.warn('[ppTPE] TPESession upsert error:', e?.message);
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
