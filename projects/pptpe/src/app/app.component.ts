import { ChangeDetectorRef, Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
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
import { SHARED_TPE_REQUEST_ID } from '../../../common/tpe-shared';
import { NfcTagReaderService } from './nfc/nfc-tag-reader.service';
import { AcrBleReaderService } from './nfc/acr-ble-reader.service';
import { NfcRelayService } from './nfc/nfc-relay.service';

type AppState = 'checking-auth' | 'login' | 'scanning' | 'connecting' | 'connected' | 'processing' | 'error';

interface Light {
  color: 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
  label: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private readonly nfcReader = inject(NfcTagReaderService);
  private readonly acrReader = inject(AcrBleReaderService);
  private readonly nfcRelay = inject(NfcRelayService);
  state: AppState = 'checking-auth';
  readerLabel = '';
  firmwareProgress = 0;
  currentMemberName = '';
  currentAmountCents = 0;
  errorMessage = '';
  tokenError = '';
  loginEmail = '';
  loginPassword = '';
  showLoginPassword = false;
  readonly appVersion = environment.buildDate;
  loginError = '';
  loginLoading = false;
  readonly nfcState = this.nfcReader.state;
  readonly nfcScans = this.nfcReader.scans;
  readonly nfcReadError = this.nfcReader.readError;
  readonly acrState = this.acrReader.state;
  readonly acrScans = this.acrReader.scans;
  readonly acrReadError = this.acrReader.readError;
  readonly relayConnected = this.nfcRelay.connected;
  readonly relayCollector = this.nfcRelay.collector;
  readonly relayLastReading = this.nfcRelay.lastReading;
  readonly buzzerEnabled = this.nfcRelay.buzzerEnabled;

  onBuzzerToggle(enabled: boolean): void {
    this.nfcRelay.setBuzzer(enabled);
  }

  readonly relayActivity = computed(() => {
    const { status, tournament } = this.relayCollector();
    if (status !== 'active' && status !== 'paused') return 'Aucune fonction active';
    if (tournament.startsWith('Espace NFC — ')) return tournament;
    return tournament ? `Pointage — ${tournament}` : 'Pointage';
  });

  readonly readerLight = computed<Light>(() => {
    switch (this.acrState().status) {
      case 'ready': return { color: 'success', label: 'Prêt' };
      case 'read-error': return { color: 'warning', label: 'Lecture incomplète' };
      case 'scanning': return { color: 'warning', label: 'Recherche du lecteur…' };
      case 'not-found': return { color: 'danger', label: 'Lecteur introuvable' };
      case 'permission': return { color: 'danger', label: 'Autorisation Bluetooth requise' };
      case 'error': return { color: 'danger', label: 'Lecteur indisponible' };
      default: return { color: 'secondary', label: 'Arrêté' };
    }
  });

  readonly relayLight = computed<Light>(() => {
    if (!this.relayConnected()) return { color: 'secondary', label: 'Non relié (connexion requise)' };
    switch (this.nfcRelay.feedback()?.result) {
      case 'pending': return { color: 'warning', label: 'Vérification…' };
      case 'accepted': return { color: 'success', label: 'Accepté' };
      case 'refused': return { color: 'danger', label: 'Refusé' };
      case 'read': return { color: 'primary', label: 'Carte lue' };
      case 'unanswered': return { color: 'warning', label: 'Carte non traitée' };
    }
    switch (this.relayCollector().status) {
      case 'active': return { color: 'primary', label: 'Prêt' };
      case 'paused': return { color: 'secondary', label: 'Suspendu' };
      case 'stopped': return { color: 'secondary', label: 'Arrêté' };
      default: return { color: 'secondary', label: 'En attente d’une demande' };
    }
  });

  // Token cache — pré-fetché avant connectReader pour répondre instantanément au SDK
  private cachedToken: string | null = null;
  private cachedTokenAt = 0;
  private readonly TOKEN_TTL_MS = 4 * 60 * 1000;
  private readonly BLE_SETTLE_MS = 1500;

  private client!: ReturnType<typeof generateClient<Schema>>;
  private tpeSessionId: string | null = null;
  private paymentRequestSub: any = null;
  private capacitorInitialized = false;
  private readonly processedPaymentIds = new Set<string>();
  private paymentClaimInFlight = false;
  private latestPaymentRequests: any[] = [];
  private heartbeatInterval: any = null;
  private resumeWatchdog: any = null;
  private lastResumeTime = 0;
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
    void this.nfcReader.start();
    void this.acrReader.start();
    this.checkAuth();
  }

  ngOnDestroy(): void {
    this.paymentRequestSub?.unsubscribe();
    this.nfcReader.stop();
    this.acrReader.stop();
    this.nfcRelay.detach();
    this.stopHeartbeat();
    this.clearResumeWatchdog();
    // Fermeture propre : marquer la session comme déconnectée
    this.upsertTPESession('disconnected', '').catch(() => {});
  }

  onAcrRetry(): void {
    void this.acrReader.start();
  }

  // ──────────────────────────────────────────────────────────
  // Auth
  // ──────────────────────────────────────────────────────────

  private async checkAuth(): Promise<void> {
    try {
      const user = await getCurrentUser();
      this.tpeSessionId = user.userId; // ID déterministe = 1 session par user
      this.nfcRelay.attach(user.userId);
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
      this.nfcRelay.attach(user.userId);
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
    this.nfcRelay.detach();
    await this.upsertTPESession('disconnected', '');
    if (this.capacitorInitialized) {
      await StripeTerminal.disconnectReader().catch(() => {});
    }
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
      // Clean up any residual session -- SDK is guaranteed initialized here
      await StripeTerminal.disconnectReader().catch(() => {});
      await this.upsertTPESession('scanning', '');

      const readers = await this.discoverReaders();
      if (readers.length === 0) {
        this.errorMessage = 'Aucun lecteur trouvé (30s). Vérifiez que le WisePad 3 est allumé et à portée Bluetooth.';
        this.state = 'error';
        await this.upsertTPESession('disconnected', '');
        return;
      }

      // Pré-charger le token pour que RequestedConnectionToken soit servi sans latence Lambda
      this.clearCachedConnectionToken();
      await this.getCachedConnectionToken();

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
      this.cdr.detectChanges();

    } catch (e: any) {
      this.errorMessage = e.message || 'Erreur initialisation TPE';
      this.state = 'error';
      await this.upsertTPESession('disconnected', '');
      this.cdr.detectChanges();
    } finally {
      this.tpeStarting = false;
    }
  }

  // Demande explicite des permissions BLE runtime (Android 12+)
  private async initCapacitor(): Promise<void> {
    if (this.capacitorInitialized) return;

    await StripeTerminal.addListener(TerminalEventsEnum.RequestedConnectionToken, async () => {
      console.log('[ppTPE] RequestedConnectionToken fired — fetching token...');
      try {
        const token = await this.takeConnectionToken();
        console.log('[ppTPE] Connection token fetched OK, longueur:', token?.length);
        this.tokenError = '';
        await StripeTerminal.setConnectionToken({ token });
      } catch (e: any) {
        const msg = e?.message || 'Erreur inconnue';
        console.error('[ppTPE] fetchConnectionToken ERREUR:', msg);
        this.tokenError = `Token: ${msg}`;
        this.cdr.detectChanges();
        await StripeTerminal.setConnectionToken({ token: '' });
      }
    });

    await StripeTerminal.addListener(TerminalEventsEnum.UnexpectedReaderDisconnect, async () => {
      console.warn('[ppTPE] UnexpectedReaderDisconnect');
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

    await StripeTerminal.addListener(TerminalEventsEnum.FinishInstallingUpdate, (args: any) => {
      if (args?.error) {
        console.error('[ppTPE] Mise à jour firmware ÉCHOUÉE:', args.error);
        this.tokenError = `Firmware: ${args.error}`;
        this.cdr.detectChanges();
      } else {
        console.log('[ppTPE] Mise à jour firmware WisePad 3 terminée');
      }
      this.firmwareProgress = 0;
    });

    // Motif de déconnexion BLE (diagnostic)
    await StripeTerminal.addListener(TerminalEventsEnum.DisconnectedReader, ({ reason }: any) => {
      console.warn('[ppTPE] DisconnectedReader reason:', reason ?? 'none');
      if (reason && reason !== 'DISCONNECT_REQUESTED') {
        this.tokenError = `Déco: ${reason}`;
        this.cdr.detectChanges();
      }
    });

    // ConnectionStatusChange sert uniquement à confirmer le réveil BLE (watchdog + heartbeat).
    // Ne pas déclencher de reconnexion ici : cet événement ne distingue pas les
    // déconnexions attendues (disconnectReader) des inattendues → utiliser UnexpectedReaderDisconnect.
    await StripeTerminal.addListener(TerminalEventsEnum.ConnectionStatusChange, async ({ status }) => {
      console.log('[ppTPE] ConnectionStatusChange:', status);
      if (status === ConnectionStatus.Connected) {
        // Confirme la connexion BLE (y compris après réveil de veille)
        this.clearResumeWatchdog();
        this.tokenError = '';
        if (this.state === 'connected' || this.state === 'processing') {
          this.startHeartbeat(); // redémarre le timer suspendu pendant la veille
        }
      }
    });

    // Watchdog au réveil : si aucun ConnectionStatus(Connected) dans les 5s → forcer reconnexion
    // Couvre le cas où les events SDK ont été perdus pendant la mise en veille Android
    document.addEventListener('resume', () => {
      const now = Date.now();
      if (now - this.lastResumeTime < 1000) return; // débounce Capacitor double-fire
      this.lastResumeTime = now;
      if (this.state === 'connected' || this.state === 'processing') {
        // Heartbeat immédiat pour éviter la détection de staleness côté shop
        this.upsertTPESession('connected', this.readerLabel).catch(() => {});
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
        StripeTerminal.cancelDiscoverReaders().catch(() => {}).finally(() => {
          setTimeout(() => resolve(candidates), this.BLE_SETTLE_MS);
        });
      }).then((h) => { handle = h; });

      if (environment.tpe_simulated) {
        StripeTerminal.setSimulatorConfiguration({
          simulatedCard: SimulatedCardType.Visa,
          update: SimulateReaderUpdate.None,
        }).catch(() => {});
      }

      const discoverOpts: any = {
        type: environment.tpe_simulated
          ? TerminalConnectTypes.Bluetooth  // simulated BLE (WPC30SIMULATOR) -- avoids S700 TLV bug
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
        this.latestPaymentRequests = items ?? [];
        this.processNextPaymentRequest();
      },
      error: (e: any) => console.warn('[ppTPE] PaymentRequest subscription error:', e?.message),
    });
  }

  private processNextPaymentRequest(): void {
    if (this.paymentClaimInFlight || this.state !== 'connected') return;
    const pending = this.latestPaymentRequests.find(
      (pr: any) => pr.status === 'pending'
        && (!environment.tpe_shared_enabled || (pr.id === SHARED_TPE_REQUEST_ID && !!pr.reservationId))
        && !this.processedPaymentIds.has(this.paymentRequestKey(pr)),
    );
    if (pending) void this.handlePaymentRequest(pending);
  }

  private paymentRequestKey(pr: { id: string; reservationId?: string }): string {
    return environment.tpe_shared_enabled ? `${pr.id}:${pr.reservationId}` : pr.id;
  }

  private async handlePaymentRequest(pr: any): Promise<void> {
    if (this.paymentClaimInFlight || this.state !== 'connected') return;
    if (environment.tpe_shared_enabled && (pr.id !== SHARED_TPE_REQUEST_ID || !pr.reservationId)) return;
    this.paymentClaimInFlight = true;
    this.processedPaymentIds.add(this.paymentRequestKey(pr));
    let paymentConfirmed = false;
    const claimCondition = environment.tpe_shared_enabled
      ? { and: [{ status: { eq: 'pending' } }, { reservationId: { eq: pr.reservationId } }] }
      : { status: { eq: 'pending' } };
    const resultCondition = environment.tpe_shared_enabled
      ? { condition: { and: [{ status: { eq: 'processing' } }, { reservationId: { eq: pr.reservationId } }] } }
      : undefined;

    try {
      try {
        const { data, errors } = await (this.client.models.PaymentRequest.update(
          { id: pr.id, status: 'processing' } as any,
          { condition: claimCondition } as any,
        ) as any);
        if (errors?.length || !data) {
          console.warn('[ppTPE] Demande non acquise; aucune collecte lancée', errors);
          return;
        }
      } catch (error) {
        console.warn('[ppTPE] Prise en charge non confirmée; aucune collecte lancée', error);
        return;
      }

      this.currentMemberName = pr.memberName;
      this.currentAmountCents = pr.amountCents;
      this.state = 'processing';
      this.cdr.detectChanges();

      // Utiliser la chaîne de Promises directement — plus fiable que les événements
      // ConfirmedPaymentIntent (Capacitor addListener est async, risque de race condition)
      await this.collectAndConfirmPayment(pr.clientSecret);
      paymentConfirmed = true;

      const { errors } = await (this.client.models.PaymentRequest.update(
        { id: pr.id, status: 'success' } as any, resultCondition as any,
      ) as any);
      if (errors?.length) {
        console.error('[ppTPE] update success error:', JSON.stringify(errors));
      } else {
        console.log('[ppTPE] Paiement confirmé — PaymentRequest mis à jour success');
      }

    } catch (e: any) {
      const msg: string = e?.message ?? 'Erreur TPE';
      console.warn('[ppTPE] handlePaymentRequest error:', msg);
      if (paymentConfirmed) {
        console.error('[ppTPE] Paiement confirmé mais résultat non publié; rapprochement nécessaire', pr.id);
        return;
      }
      const isCancelled = /annul|cancel/i.test(msg);
      try {
        const { errors } = await this.client.models.PaymentRequest.update({
          id: pr.id,
          status: isCancelled ? 'cancelled' : 'failed',
          errorMessage: msg,
        } as any, resultCondition as any);
        if (errors?.length) console.error('[ppTPE] Résultat TPE non publié:', errors);
      } catch (error) {
        console.error('[ppTPE] Résultat TPE non publié:', error);
      }
    } finally {
      this.paymentClaimInFlight = false;
      if (this.state === 'processing') {
        this.state = 'connected';
      }
      this.currentMemberName = '';
      this.currentAmountCents = 0;
      this.cdr.detectChanges();
      this.processNextPaymentRequest();
    }
  }

  private async collectAndConfirmPayment(clientSecret: string): Promise<void> {
    await StripeTerminal.collectPaymentMethod({ paymentIntent: clientSecret });
    await StripeTerminal.confirmPaymentIntent();
  }

  // ──────────────────────────────────────────────────────────
  // Heartbeat TTL — maintient la session "fraîche" toutes les 3 min
  // Permet à l'admin de détecter la perte de ppTPE en ≤ 3 min
  // ──────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(async () => {
      if (this.state === 'connected' || this.state === 'processing') {
        // Vérifier que le SDK connaît toujours un reader connecté avant d'écrire 'connected'
        try {
          const { reader } = await StripeTerminal.getConnectedReader();
          if (reader) {
            this.upsertTPESession('connected', this.readerLabel).catch(() => {});
          } else {
            console.warn('[ppTPE] Heartbeat: getConnectedReader() = null malgré state=connected → déconnexion forcée');
            this.state = 'scanning';
            this.cdr.detectChanges();
            this.stopHeartbeat();
            await this.upsertTPESession('disconnected', '');
            setTimeout(() => this.startTPE(), 3000);
          }
        } catch {
          // En cas d'erreur SDK, ne pas perturber — on garde l'état actuel
          this.upsertTPESession('connected', this.readerLabel).catch(() => {});
        }
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

  private async getCachedConnectionToken(): Promise<string> {
    if (this.cachedToken && Date.now() - this.cachedTokenAt < this.TOKEN_TTL_MS) {
      console.log('[ppTPE] Connection token servi depuis cache');
      return this.cachedToken;
    }
    const token = await this.fetchConnectionToken();
    this.cachedToken = token;
    this.cachedTokenAt = Date.now();
    return token;
  }

  private async takeConnectionToken(): Promise<string> {
    const token = await this.getCachedConnectionToken();
    this.clearCachedConnectionToken();
    return token;
  }

  private clearCachedConnectionToken(): void {
    this.cachedToken = null;
    this.cachedTokenAt = 0;
  }

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
