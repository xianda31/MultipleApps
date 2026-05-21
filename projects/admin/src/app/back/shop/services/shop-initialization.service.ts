import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Session, Expense, Revenue } from '../../../common/interfaces/accounting.interface';
import { SystemDataService } from '../../../common/services/system-data.service';
import { GroupService } from '../../../common/authentification/group.service';
import { BookService } from '../../services/book.service';
import { ToastService } from '../../../common/services/toast.service';
import { StripeTerminalService } from './stripe-terminal.service';
import { generateClient } from 'aws-amplify/data';
import { Schema } from '../../../../../../../amplify/data/resource';
import { environment } from '../../../../environments/environment';

export interface ShopInitState {
  session: Session;
  operations: (Revenue | Expense)[];
  canEditPrice: boolean;
}

/**
 * ShopInitializationService
 * Gère l'initialisation de la boutique: session, permissions, opérations,
 * et l'état de connexion TPE (réactif via AppSync ou BLE).
 */
@Injectable({
  providedIn: 'root'
})
export class ShopInitializationService implements OnDestroy {

  // ── TPE state réactif — consommé par ShopComponent via subscription ──
  readonly tpeReaderConnected$ = new BehaviorSubject<boolean>(false);
  readonly tpeReaderLabel$     = new BehaviorSubject<string>('');
  readonly tpeScanning$        = new BehaviorSubject<boolean>(false);

  private tpeSessionSub: any = null;
  private tpeInitialized = false;
  private tpeToastShown  = false;
  private lastKnownConnectedTtl = 0; // Unix s — utilisé par le staleness timer
  private stalenessTimer: any = null;
  private wakeGraceUntil = 0; // ms — staleness timer suspendu après réveil de veille
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      // Laisse 15s au heartbeat de ppTPE pour arriver via AppSync avant de juger la fraîcheur
      this.wakeGraceUntil = Date.now() + 15_000;
    }
  };

  constructor(
    private systemDataService: SystemDataService,
    private groupService: GroupService,
    private bookService: BookService,
    private toastService: ToastService,
    private stripeTerminal: StripeTerminalService,
  ) {}

  /**
   * Initialise la session (date, saison)
   */
  initializeSession(): Session {
    const today = new Date();
    return {
      date: today.toISOString().split('T')[0],
      season: this.systemDataService.get_season(today),
    };
  }

  /**
   * Charge les opérations du journal
   */
  async loadOperations(): Promise<(Revenue | Expense)[]> {
    return new Promise((resolve) => {
      this.bookService.list_book_entries().subscribe(() => {
        resolve(this.bookService.get_operations());
      });
    });
  }

  /**
   * Détermine les permissions du caissier
   * Niveau 2+ (Editor, Admin, System) peut éditer les prix
   */
  async determinePermissions(): Promise<{ canEditPrice: boolean }> {
    try {
      const accreditation = await this.groupService.getUserAccreditation();
      return {
        canEditPrice: accreditation.level >= 2,
      };
    } catch {
      return { canEditPrice: false };
    }
  }

  /**
   * Initialisation complète
   */
  async initializeShop(): Promise<ShopInitState> {
    const session = this.initializeSession();
    const operations = await this.loadOperations();
    const permissions = await this.determinePermissions();

    return {
      session,
      operations,
      canEditPrice: permissions.canEditPrice,
    };
  }

  // ──────────────────────────────────────────────────────────
  // TPE : état de connexion centralisé
  // ──────────────────────────────────────────────────────────

  /**
   * Initialise la gestion TPE (idempotent — sûr à appeler plusieurs fois).
   * - Mode distant (PC) : souscrit au TPESession AppSync ; toast de rappel après 5s.
   * - Mode local (Android) : lance la découverte BLE et connecte le premier reader trouvé.
   */
  async initTPE(tpePaymentActive: boolean): Promise<void> {
    if (!tpePaymentActive || this.tpeInitialized) return;
    this.tpeInitialized = true;

    if (!this.stripeTerminal.isNativeAndroid) {
      // ── Mode distant (PC) ──
      this.subscribeTPESession();
      setTimeout(() => {
        if (!this.tpeReaderConnected$.value && !this.tpeToastShown) {
          this.tpeToastShown = true;
          this.toastService.showInfo(
            'TPE distant',
            'Lancez ppTPE sur la tablette Android pour activer le paiement par carte.',
          );
        }
      }, 5000);
    } else {
      // ── Mode local (Android BLE) ──
      await this.autoDiscoverBLE();
    }
  }

  /** Relance la découverte BLE (Android) — bouton "Réessayer" dans le status card. */
  async retryBLEDiscovery(): Promise<void> {
    if (this.stripeTerminal.isNativeAndroid) {
      this.tpeInitialized = false; // allow retry
      await this.autoDiscoverBLE();
    }
  }

  /** Met à jour l'état déconnecté (appelé après disconnectReader). */
  notifyDisconnected(): void {
    this.tpeReaderConnected$.next(false);
    this.tpeReaderLabel$.next('');
  }

  private subscribeTPESession(): void {
    if (this.tpeSessionSub) return;
    try {
      const client = generateClient<Schema>();
      this.tpeSessionSub = (client.models.TPESession.observeQuery() as any).subscribe({
        next: ({ items }: any) => {
          // Trier par updatedAt DESC pour prendre la session la plus récente
          const sorted = [...items].sort((a: any, b: any) =>
            (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
          );
          // Fraîcheur TTL : même fenêtre 5 min que le staleness timer.
          // Évite le flash "connecté" au démarrage si le dernier record est stale.
          // ppTPE en background < 5 min : heartbeat resume remet le TTL à jour immédiatement.
          const staleFloor = Math.floor(Date.now() / 1000) + 3300; // 3600 - 300s (5 min)
          const fresh = (s: any) => Number(s.ttl) > staleFloor;
          const connected = sorted.find((s: any) => s.status === 'connected' && fresh(s));
          const scanning  = sorted.find((s: any) => s.status === 'scanning'  && fresh(s));
          if (connected) {
            this.lastKnownConnectedTtl = Number(connected.ttl);
            this.tpeReaderConnected$.next(true);
            this.tpeReaderLabel$.next(connected.readerLabel || 'WisePad 3');
            this.tpeScanning$.next(false);
          } else if (scanning) {
            this.lastKnownConnectedTtl = 0;
            this.tpeReaderConnected$.next(false);
            this.tpeReaderLabel$.next('');
            this.tpeScanning$.next(true);
          } else {
            this.lastKnownConnectedTtl = 0;
            this.tpeReaderConnected$.next(false);
            this.tpeReaderLabel$.next('');
            this.tpeScanning$.next(false);
          }
        },
        error: (err: any) => {
          console.warn('[TPESession] subscription error:', err?.message);
        },
      });
      // Staleness timer : détecte ppTPE arrêté sans écriture explicite 'disconnected'
      // Fenêtre 5 min : tolère les backgrounds courts, détecte un crash en ≤5 min.
      // Math : TTL = write_time+3600 ; stale si write_time+3600 ≤ now+(3600-300)
      //        ⇔ write_time ≤ now-300 ⇔ dernière écriture il y a > 5 min.
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.stalenessTimer = setInterval(() => {
        if (this.lastKnownConnectedTtl > 0 && Date.now() > this.wakeGraceUntil) {
          const staleFloor = Math.floor(Date.now() / 1000) + 3300; // 3600 - 300s (5 min)
          if (this.lastKnownConnectedTtl <= staleFloor) {
            console.warn('[TPESession] Staleness détectée — ppTPE inactif depuis > 5 min');
            this.lastKnownConnectedTtl = 0;
            this.tpeReaderConnected$.next(false);
            this.tpeReaderLabel$.next('');
            this.tpeScanning$.next(false);
          }
        }
      }, 15_000); // vérification toutes les 15 s
    } catch (err: any) {
      console.warn('[TPESession] observeQuery failed:', err?.message);
    }
  }

  private async autoDiscoverBLE(): Promise<void> {
    this.tpeScanning$.next(true);
    try {
      const readers = await this.stripeTerminal.discoverReaders(environment.tpe_simulated);
      if (readers.length === 0) {
        this.toastService.showWarning('TPE', 'Aucun reader trouvé. Vérifiez que le WisePad 3 est allumé et à portée Bluetooth.');
        return;
      }
      await this.stripeTerminal.connectReader(readers[0]);
      this.tpeReaderConnected$.next(true);
      this.tpeReaderLabel$.next(readers[0].label || readers[0].serialNumber || 'WisePad 3');
      // Réagir aux déconnexions inattendues
      this.stripeTerminal.status$.subscribe(status => {
        if (status === 'disconnected') {
          this.tpeReaderConnected$.next(false);
          this.tpeReaderLabel$.next('');
          this.toastService.showWarning('TPE', 'WisePad 3 déconnecté. Vérifiez la portée Bluetooth.');
        }
      });
    } catch (err: any) {
      this.toastService.showError('TPE', err.message || 'Erreur de connexion au reader');
    } finally {
      this.tpeScanning$.next(false);
    }
  }

  ngOnDestroy(): void {
    this.tpeSessionSub?.unsubscribe();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.stalenessTimer !== null) {
      clearInterval(this.stalenessTimer);
      this.stalenessTimer = null;
    }
  }
}
