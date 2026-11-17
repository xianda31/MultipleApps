import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { NgbDropdownModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import {
  MemberNfcCardService, NfcCaptureTimeoutError, NfcReaderStatus,
} from '../../../common/services/member-nfc-card.service';
import { MembersService } from '../../../common/services/members.service';
import { ToastService } from '../../../common/services/toast.service';
import { Game } from '../fees.interface';
import { FeesCollectorService } from './fees-collector.service';

@Component({
  selector: 'app-fees-nfc-control',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule, NgbTooltipModule],
  templateUrl: './fees-nfc-control.component.html',
  styles: [`
    :host { display: inline-block; }
    .dropdown-toggle::after { display: none; }
    .nfc-panel {
      width: min(23rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
  `],
})
export class FeesNfcControlComponent implements OnChanges, OnDestroy {
  @Input() game!: Game;
  @Input() paymentPreference: 'card' | 'euro' = 'card';
  @Input() blocked = false;
  @Output() checkedIn = new EventEmitter<void>();

  reader: NfcReaderStatus | null = null;
  panelOpen = false;
  checking = false;
  testing = false;
  active = false;
  starting = false;
  paused = false;
  error = '';
  notice = '';
  lastReading: { uid: string; message: string; accepted: boolean; at: Date } | null = null;
  private operation?: AbortController;
  private session?: AbortController;
  private sessionKey = '';
  private previousGameKey = '';
  private wasEligible = false;
  private autoStartRequested = false;
  private destroyed = false;

  constructor(
    private readonly bridge: MemberNfcCardService,
    private readonly members: MembersService,
    private readonly fees: FeesCollectorService,
    private readonly toast: ToastService,
  ) {}

  get sessionPending(): boolean { return !!this.session; }
  get busy(): boolean { return this.checking || this.testing; }
  private get gameKey(): string { return `${this.game?.season}:${this.game?.tournament?.id}`; }

  get unavailableReason(): string {
    if (!this.fees.nfcCheckInEnabled) return 'Le pointage NFC n’est pas autorisé dans la configuration.';
    if (!this.game?.tournament) return 'Sélectionnez un tournoi.';
    if (this.paymentPreference !== 'card') return 'Le tournoi est à priorité Euro : seul le diagnostic est disponible.';
    if (this.blocked) return 'Le tournoi est verrouillé ou en cours de modification.';
    return '';
  }

  get readerLabel(): string {
    if (!this.reader) return 'État non vérifié';
    const labels: Record<NfcReaderStatus['readerStatus'], string> = {
      Starting: 'Démarrage',
      Ready: 'Déclaré disponible par Windows',
      CardRead: 'Carte détectée',
      Disconnected: 'Lecteur déconnecté',
      Error: 'Erreur lecteur',
    };
    return labels[this.reader.readerStatus];
  }

  ngOnChanges(): void {
    const key = this.gameKey;
    const tournamentChanged = this.previousGameKey !== key;
    const eligible = !this.unavailableReason;
    if (tournamentChanged) {
      this.previousGameKey = key;
      this.paused = false;
      this.operation?.abort('cancelled');
    }
    if (this.session && !this.session.signal.aborted && (this.sessionKey !== key || !eligible)) {
      this.stopSession('Pointage NFC arrêté : le tournoi ou ses conditions d’activation ont changé.', false);
    }
    if (!eligible) this.autoStartRequested = false;
    else if (tournamentChanged || !this.wasEligible) this.autoStartRequested = !this.paused;
    this.wasEligible = eligible;
    this.startAutomaticallyIfRequested();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.leavePage();
  }

  @HostListener('window:pagehide')
  leavePage(): void {
    this.stopSession();
    this.operation?.abort('cancelled');
  }

  panelOpened(open: boolean): void {
    this.panelOpen = open;
    if (open && !this.busy && !this.starting) void this.refreshStatus();
  }

  async refreshStatus(): Promise<void> {
    if (this.busy || this.starting) return;
    const abort = new AbortController();
    this.operation = abort;
    this.checking = true;
    this.error = '';
    this.reader = null;
    try {
      const reader = await this.timed(abort, 5000, signal => this.bridge.status(signal));
      if (!abort.signal.aborted) {
        this.reader = reader;
        if (this.sessionPending && (reader.readerStatus === 'Disconnected' || reader.readerStatus === 'Error')) {
          this.stopSession('Pointage NFC arrêté : le lecteur est indisponible.', false);
        }
      }
    } catch (error) {
      this.reportError(error, abort);
      if (!abort.signal.aborted || abort.signal.reason === 'timeout') {
        this.stopSession('Pointage NFC arrêté : la liaison ppNFC n’est plus vérifiée.', false);
      }
    } finally {
      this.checking = false;
      if (this.operation === abort) this.operation = undefined;
      this.startAutomaticallyIfRequested();
    }
  }

  async testRead(): Promise<void> {
    if (this.busy || this.sessionPending) return;
    const abort = new AbortController();
    this.operation = abort;
    this.testing = true;
    this.error = '';
    this.notice = 'Présentez une carte. Ce test ne pointe aucun joueur.';
    try {
      const uid = await this.timed(abort, 35000, signal => this.bridge.acquire(signal));
      if (!abort.signal.aborted) {
        this.lastReading = { uid, message: 'Lecture test réussie : aucun pointage effectué.', accepted: false, at: new Date() };
        this.notice = '';
      }
    } catch (error) {
      if (!abort.signal.aborted || abort.signal.reason === 'timeout') this.notice = '';
      this.reportError(error, abort);
    } finally {
      this.testing = false;
      if (this.operation === abort) this.operation = undefined;
      this.startAutomaticallyIfRequested();
    }
  }

  cancelTest(): void {
    this.operation?.abort('cancelled');
    this.notice = 'Lecture test annulée.';
  }

  async startSession(): Promise<void> {
    if (this.busy || this.sessionPending) return;
    if (this.unavailableReason) {
      this.error = this.unavailableReason;
      return;
    }
    this.paused = false;
    this.autoStartRequested = false;
    const abort = new AbortController();
    const key = this.gameKey;
    this.session = abort;
    this.sessionKey = key;
    this.starting = true;
    this.error = '';
    this.notice = '';
    this.lastReading = null;
    this.reader = null;
    try {
      this.reader = await this.timed(abort, 5000, signal => this.bridge.status(signal));
      if (!this.isCurrent(abort, key)) return;
      if (this.reader.capturing) throw new Error('Une lecture est déjà en cours dans un autre écran ou onglet.');
      if (this.reader.readerStatus !== 'Ready' && this.reader.readerStatus !== 'CardRead') {
        throw new Error(`Impossible d’activer le pointage : ${this.readerLabel}.`);
      }
      this.starting = false;
      this.active = true;
      while (this.isCurrent(abort, key)) {
        let uid: string;
        try {
          uid = await this.timed(abort, 35000, signal => this.bridge.acquire(signal));
        } catch (error) {
          if (error instanceof NfcCaptureTimeoutError && this.isCurrent(abort, key)) continue;
          throw error;
        }
        if (this.isCurrent(abort, key)) await this.checkInUid(uid, abort, key);
      }
    } catch (error) {
      if (!abort.signal.aborted || abort.signal.reason === 'timeout') this.reader = null;
      this.reportError(error, abort);
    } finally {
      if (this.session === abort) {
        this.active = false;
        this.starting = false;
        this.session = undefined;
        this.startAutomaticallyIfRequested();
      }
    }
  }

  stopSession(message = 'Pointage NFC suspendu.', manualPause = true): void {
    if (manualPause) this.paused = true;
    this.autoStartRequested = false;
    this.session?.abort('cancelled');
    this.active = false;
    this.starting = false;
    this.notice = message;
  }

  private startAutomaticallyIfRequested(): void {
    if (this.autoStartRequested && !this.destroyed && !this.paused && !this.unavailableReason
      && !this.busy && !this.sessionPending) {
      void this.startSession();
    }
  }

  private isCurrent(abort: AbortController, key: string): boolean {
    return !this.destroyed && !abort.signal.aborted && key === this.gameKey && !this.unavailableReason;
  }

  private async checkInUid(uid: string, abort: AbortController, key: string): Promise<void> {
    try {
      const card = await this.bridge.get(uid);
      if (!this.isCurrent(abort, key)) return;
      if (!card) throw new Error('Carte inconnue.');
      if (card.status !== 'ACTIVE' || !card.licenseNumber || card.stockState === 'LOST' || card.stockState === 'RETIRED') {
        throw new Error('Carte désactivée, non attribuée ou indisponible.');
      }
      const license = card.licenseNumber.trim().padStart(8, '0');
      const players = this.game.gamers.filter(gamer => gamer.license.padStart(8, '0') === license);
      if (players.length !== 1) throw new Error('Le titulaire n’est pas inscrit de manière unique à ce tournoi.');
      const gamer = players[0];
      if (!gamer.is_member || !gamer.member_id) throw new Error('Le titulaire ne correspond pas à un adhérent du tournoi.');
      const member = await this.members.readMember(gamer.member_id);
      if (!this.isCurrent(abort, key)) return;
      if (!member || member.license_number.padStart(8, '0') !== license || member.lifecycleStatus !== 'ACTIVE') {
        throw new Error('Adhérent introuvable, non actif ou identité non confirmée.');
      }
      const alreadyCheckedIn = gamer.validated;
      const accepted = await this.fees.checkInByNfc(license, abort.signal);
      if (!this.isCurrent(abort, key)) return;
      this.lastReading = {
        uid, accepted, at: new Date(),
        message: accepted
          ? `${gamer.firstname} ${gamer.lastname} : ${alreadyCheckedIn ? 'déjà pointé par carte' : 'pointage carte confirmé'}.`
          : `${gamer.firstname} ${gamer.lastname} : pointage refusé ou non confirmé. Consultez le message de pointage.`,
      };
      this.showTraceReading();
      if (accepted && !alreadyCheckedIn) this.checkedIn.emit();
    } catch (error) {
      if (!this.isCurrent(abort, key)) return;
      console.error('[Pointage NFC] Vérification de carte impossible:', error);
      this.lastReading = {
        uid, accepted: false, at: new Date(),
        message: error instanceof Error ? error.message : 'Vérification de la carte impossible. Aucun pointage confirmé.',
      };
      this.showTraceReading();
    }
  }

  private showTraceReading(): void {
    const reading = this.lastReading;
    if (this.fees.sys_conf?.trace_mode !== true || !reading) return;
    const message = `${reading.message} (UID : ${reading.uid})`;
    if (reading.accepted) this.toast.showSuccess('Pointage NFC', message);
    else this.toast.showWarning('Pointage NFC', message);
  }

  private async timed<T>(abort: AbortController, timeout: number, action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const timer = window.setTimeout(() => abort.abort('timeout'), timeout);
    try {
      return await action(abort.signal);
    } finally {
      window.clearTimeout(timer);
    }
  }

  private reportError(error: unknown, abort: AbortController): void {
    if (abort.signal.aborted && abort.signal.reason !== 'timeout') return;
    console.error('[Pointage NFC]', error);
    this.error = abort.signal.reason === 'timeout'
      ? 'ppNFC ne répond pas dans le délai prévu. Vérifiez la liaison puis réessayez.'
      : error instanceof Error ? error.message : 'Opération NFC impossible.';
  }
}
