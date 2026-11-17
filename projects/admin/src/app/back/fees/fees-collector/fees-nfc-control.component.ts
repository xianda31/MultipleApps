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

type CheckInFeedback = 'checking' | 'accepted' | 'refused';

@Component({
  selector: 'app-fees-nfc-control',
  standalone: true,
  imports: [CommonModule, NgbDropdownModule, NgbTooltipModule],
  templateUrl: './fees-nfc-control.component.html',
  styles: [`
    :host { display: inline-block; }
    .dropdown-toggle::after { display: none; }
    .nfc-indicator {
      display: inline-flex;
      align-items: center;
      gap: .5rem;
      padding: .25rem .5rem;
      font-size: .8rem;
    }
    .nfc-status-light {
      flex: 0 0 1rem;
      width: 1rem;
      height: 1rem;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 .4rem currentColor;
    }
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
  private checkInFeedback?: CheckInFeedback;
  private feedbackTimer?: number;
  private readerErrorConfirmed = false;

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
    const probe = this.reader.hardwareProbe;
    if (probe?.state === 'Unverified') return 'Lecteur non vérifié par PC/SC';
    if (probe?.state === 'Unresponsive') return 'Lecteur non joignable';
    if (probe?.state === 'Responsive') {
      switch (probe.pcdPiccStatus) {
        case 0: return 'Lecteur répond — RF coupée';
        case 1: return 'Lecteur répond — aucune carte';
        case 2: return 'Lecteur répond — carte prête';
        case 3: return 'Lecteur répond — carte sélectionnée';
        case 255: return 'Réponse en erreur PCD/PICC';
        default: return 'Réponse ACS inconnue';
      }
    }
    const labels: Record<NfcReaderStatus['readerStatus'], string> = {
      Starting: 'Démarrage',
      Ready: 'Détecté par Windows — disponibilité physique non vérifiée',
      CardRead: 'Carte détectée — dernier état Windows',
      Disconnected: 'Lecteur déconnecté',
      Error: 'Erreur lecteur',
    };
    return labels[this.reader.readerStatus];
  }

  get readerIndicatorColor(): 'secondary' | 'warning' | 'danger' | 'success' {
    if (this.checking || this.starting || this.reader?.readerStatus === 'Starting') return 'warning';
    if (this.error && this.readerErrorConfirmed) return 'danger';
    const probe = this.reader?.hardwareProbe;
    if (probe?.state === 'Unresponsive') return 'danger';
    if (probe?.state === 'Responsive') {
      if (probe.pcdPiccStatus === 0) return 'warning';
      if (probe.pcdPiccStatus === 255) return 'danger';
      return probe.pcdPiccStatus === null ? 'warning' : 'success';
    }
    if (this.reader?.readerStatus === 'Ready' || this.reader?.readerStatus === 'CardRead') return 'warning';
    if (this.reader?.readerStatus === 'Disconnected' || this.reader?.readerStatus === 'Error') return 'danger';
    if (this.error) return 'warning';
    return 'secondary';
  }

  get readerIndicatorLabel(): string {
    if (this.checking || this.starting) return 'Vérification…';
    if (this.reader?.hardwareProbe?.state === 'Unresponsive') return this.readerLabel;
    if (this.error && this.readerErrorConfirmed) return 'Indisponible';
    if (!this.reader) return 'Non vérifié';
    if (this.reader.hardwareProbe?.state) return this.readerLabel;
    return this.reader.readerStatus === 'Ready' ? 'Détecté (Windows)' : this.readerLabel;
  }

  get readerIndicatorMessage(): string {
    if (!this.reader) return this.error || this.readerIndicatorLabel;
    const probe = this.reader.hardwareProbe;
    if (probe?.state === 'Responsive') {
      return `${this.readerLabel}. ${probe.message}${this.error ? ` ${this.error}.` : ''} Cette interrogation ponctuelle ne maintient pas le lecteur éveillé.`;
    }
    if (probe?.state === 'Unresponsive') {
      return `${this.readerLabel}. ${probe.message} Vérifiez l’alimentation USB et le bouton POWER à droite.`;
    }
    if (probe?.state === 'Unverified') return `${this.readerLabel}. ${probe.message}`;
    const error = this.error ? ` ${this.error}.` : '';
    return `${this.readerLabel}.${error} L’état Windows ne garantit pas que le lecteur physique est éveillé. Cliquez pour ouvrir le diagnostic et tester une lecture sans pointage.`;
  }

  get checkInState(): 'inactive' | 'ready' | CheckInFeedback {
    return this.active ? this.checkInFeedback ?? 'ready' : 'inactive';
  }

  get checkInIndicatorLabel(): string {
    switch (this.checkInState) {
      case 'ready': return 'Prêt';
      case 'checking': return 'Vérification…';
      case 'accepted': return 'Accepté';
      case 'refused': return 'Refusé';
      case 'inactive': return this.starting ? 'Activation…' : this.paused ? 'Suspendu' : 'Arrêté';
    }
  }

  get checkInIndicatorColor(): string {
    switch (this.checkInState) {
      case 'ready': return 'primary';
      case 'checking': return 'warning';
      case 'accepted': return 'success';
      case 'refused': return 'danger';
      case 'inactive': return 'secondary';
    }
  }

  get checkInIndicatorMessage(): string {
    if (this.checkInState === 'accepted' || this.checkInState === 'refused') {
      return this.lastReading?.message || this.checkInIndicatorLabel;
    }
    return this.active ? this.checkInIndicatorLabel : this.unavailableReason || this.error || this.notice || this.checkInIndicatorLabel;
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
    this.readerErrorConfirmed = false;
    this.reader = null;
    try {
      const reader = await this.timed(abort, 5000, signal => this.bridge.status(signal));
      if (!abort.signal.aborted) {
        this.reader = reader;
        if (this.sessionPending && (reader.readerStatus === 'Disconnected' || reader.readerStatus === 'Error'
          || reader.hardwareProbe?.state === 'Unresponsive')) {
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
    this.readerErrorConfirmed = false;
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
    this.readerErrorConfirmed = false;
    this.notice = '';
    this.lastReading = null;
    this.clearCheckInFeedback();
    this.reader = null;
    try {
      this.reader = await this.timed(abort, 5000, signal => this.bridge.status(signal));
      if (!this.isCurrent(abort, key)) return;
      if (this.reader.capturing) throw new Error('Une lecture est déjà en cours dans un autre écran ou onglet.');
      if (this.reader.hardwareProbe?.state === 'Unresponsive') {
        throw new Error(`Impossible d’activer le pointage : ${this.readerIndicatorMessage}`);
      }
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
      this.reportError(error, abort);
    } finally {
      if (this.session === abort) {
        this.clearCheckInFeedback();
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
    this.clearCheckInFeedback();
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
    this.clearCheckInFeedback();
    this.checkInFeedback = 'checking';
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
      this.showCheckInFeedback(accepted);
      this.showTraceReading();
      if (accepted && !alreadyCheckedIn) this.checkedIn.emit();
    } catch (error) {
      if (!this.isCurrent(abort, key)) return;
      console.error('[Pointage NFC] Vérification de carte impossible:', error);
      this.lastReading = {
        uid, accepted: false, at: new Date(),
        message: error instanceof Error ? error.message : 'Vérification de la carte impossible. Aucun pointage confirmé.',
      };
      this.showCheckInFeedback(false);
      this.showTraceReading();
    }
  }

  private showCheckInFeedback(accepted: boolean): void {
    this.clearCheckInFeedback();
    this.checkInFeedback = accepted ? 'accepted' : 'refused';
    this.feedbackTimer = window.setTimeout(() => this.clearCheckInFeedback(), 3000);
  }

  private clearCheckInFeedback(): void {
    window.clearTimeout(this.feedbackTimer);
    this.feedbackTimer = undefined;
    this.checkInFeedback = undefined;
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
    this.readerErrorConfirmed = !(error instanceof NfcCaptureTimeoutError || abort.signal.reason === 'timeout');
    this.error = abort.signal.reason === 'timeout'
      ? 'ppNFC ne répond pas dans le délai prévu. Vérifiez la liaison puis réessayez.'
      : error instanceof Error ? error.message : 'Opération NFC impossible.';
  }
}
