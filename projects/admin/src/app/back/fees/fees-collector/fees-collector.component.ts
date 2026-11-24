import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TournamentService } from '../../../common/services/tournament.service';
import { FeesCollectorService } from './fees-collector.service';
import { BehaviorSubject, Subscription, switchMap } from 'rxjs';
import { club_tournament_extended, Game, Game_status, Gamer } from '../fees.interface';
import { PdfService } from '../../../common/services/pdf.service';
import { HorizontalAlignment, PDF_table } from '../../../common/interfaces/pdf-table.interface';
import { FFBplayer } from '../../../common/ffb/interface/FFBplayer.interface';
import { ClubMember } from '../../../common/ffb/interface/club-member.interface';
import { InputPlayerComponent } from '../../../common/ffb/input-licensee/input-player.component';
import { InputMemberComponent } from '../../input-member/input-member.component';
import { NgbDropdownModule, NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { GetConfirmationComponent } from '../../../common/modals/get-confirmation.component';
import { ToastService } from '../../../common/services/toast.service';
import { MembersService } from '../../../common/services/members.service';
import { ProductService } from '../../../common/services/product.service';
import { BreakingNewsService } from '../../breaking-news/breaking-news.service';
import { Member } from '../../../common/interfaces/member.interface';
import { SystemDataService } from '../../../common/services/system-data.service';
import { canSelectGameCard, feeModeFromConfiguration, membershipPaymentWarningActive, membershipPaymentWarningLevel, requiredGameCredits, TournamentFeeMode } from './fees-check-in.util';
import { SettlementProgressComponent } from './settlement-progress.component';
import { GamerPair, gamerPairs, rosterSignature } from './fees-pairs.util';
import { FeesNfcControlComponent } from './fees-nfc-control.component';
import { CheckInConfirmation, FeesCheckInConfirmationComponent } from './fees-check-in-confirmation.component';
import { PaymentMode } from '../../shop/cart/cart.interface';
import { CartService } from '../../shop/cart/cart.service';
import { BuyerContextService } from '../../shop/services/buyer-context.service';
import { ShopInitializationService } from '../../shop/services/shop-initialization.service';
import { CardPaymentOrchestratorService } from '../../services/card-payment-orchestrator.service';
import { CardSaleService } from '../../services/card-sale.service';
import { StripeTerminalService } from '../../shop/services/stripe-terminal.service';
import { SharedTpeStatusComponent } from '../../shop/shared-tpe-status.component';
import { TpeReaderIndicatorComponent } from '../../shop/tpe-reader-indicator.component';
import { Bank } from '../../../common/interfaces/system-conf.interface';
import { GameCardAdvanceRequest } from '../../../../../../common/game-card-advance';
import { environment } from '../../../../environments/environment';

type OperationalMode = 'classic' | 'nfc';
type OperationalSession = { tournamentId: string; mode: OperationalMode };
const COLLECTOR_SESSION_KEY = 'fees-collector.operational-session';


@Component({
  selector: 'app-fees-collector',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, InputPlayerComponent, InputMemberComponent, NgbTooltipModule, NgbDropdownModule, FeesNfcControlComponent, FeesCheckInConfirmationComponent, SharedTpeStatusComponent, TpeReaderIndicatorComponent],
  providers: [CartService],
  templateUrl: './fees-collector.component.html',
  styleUrl: './fees-collector.component.scss'
})

export class FeesCollectorComponent implements OnDestroy, AfterViewInit {
  GAME_STATUS = Game_status;
  next_tournaments: club_tournament_extended[] = [];
  resumeTournament: club_tournament_extended | null = null;
  selected_tournament: club_tournament_extended | null = null;
  feeModes: { value: TournamentFeeMode; label: string }[] = [
    { value: 'summer', label: 'été' },
    { value: 'standard', label: 'standard' },
    { value: 'standard-doubled', label: 'doublée' },
  ];
  days_back: number = 0;
  tournamentsWindow: number = 28; // Dynamically extensible window (4 weeks)
  private daysBack$ = new BehaviorSubject<number>(0);
  game!: Game;
  already_charged: boolean = false;
  pdfLoading = false;
  new_player!: FFBplayer | null;
  new_pair_player1!: ClubMember | null;
  new_pair_player2!: ClubMember | null;
  modalErrorMessage: string = '';
  pairsModalOpen = false;
  pairEditMode: 'list' | 'add' | 'replace' | 'remove' = 'list';
  pairChangePending = false;
  private checkStatusAfterAdvance = false;
  replacementPlayer: ClubMember | null = null;
  replacedPlayer: Gamer | null = null;
  removedPair: GamerPair | null = null;
  private editingRoster = '';
  hideValidated: boolean = false;
  compactFooterVisible: boolean = false;
  private visibleGamerLicenses = new Set<string>();
  pendingCheckIns = new Set<string>();
  manualCheckInConfirmation: CheckInConfirmation | null = null;
  private manualConfirmationTimer?: number;
  private manualConfirmationGeneration = 0;
  private destroyed = false;
  CARD_PRICE !: number;
  readonly nfcCardAdvanceEnabled = environment.nfc_card_advance_enabled;
  readonly quickSaleTpeEnabled = environment.quick_sale_tpe_enabled && environment.tpe_shared_enabled;
  private cardProductId = '';
  private cardProductReady = false;
  private advanceSyncTimer?: ReturnType<typeof setInterval>;
  private advanceSyncRunning = false;
  private advanceSyncFailed = false;
  private readonly tpeSubscriptions = new Subscription();
  tpePaymentActive = false;
  tpeReaderConnected = false;
  tpeReaderScanning = false;
  tpeReaderLabel = '';
  minimumCbAmount: number | null = null;
  quickSaleTpeInProgress = false;
  quickSalePaidEntryId: string | null = null;
  members: Member[] = [];
  membershipPaymentWarningMonth = 11;
  nfcCheckInEnabled = false;
  operationalMode: OperationalMode = 'classic';
  changingOperationalMode = false;
  readonly operationalModes: { value: OperationalMode; label: string }[] = [
    { value: 'classic', label: 'Classique' },
    { value: 'nfc', label: 'NFC' },
  ];
  banks: Bank[] = [];
  readonly paymentModes = PaymentMode;
  @ViewChild('feesGamersScroll') feesGamersScroll?: ElementRef<HTMLDivElement>;
  @ViewChild(FeesNfcControlComponent) nfcControl?: FeesNfcControlComponent;

  constructor(
    private tournamentService: TournamentService,
    private feesCollectorService: FeesCollectorService,
    private pdfService: PdfService,
    private modalService: NgbModal,
    private membersService: MembersService,
    private productService: ProductService,
    private toastService: ToastService,
    private breakingNewsService: BreakingNewsService,
    private systemDataService: SystemDataService,
    private quickSaleCart: CartService,
    private buyerContext: BuyerContextService,
    private zone: NgZone,
    private shopInit: ShopInitializationService,
    readonly cardPayment: CardPaymentOrchestratorService,
    private cardSale: CardSaleService,
    readonly stripeTerminal: StripeTerminalService,
  ) {
    this.systemDataService.get_configuration().subscribe(conf => {
      this.banks = conf.banks || [];
      this.membershipPaymentWarningMonth = conf.membership_payment_warning_month ?? 11;
      this.nfcCheckInEnabled = conf.nfc_check_in_active === true;
      this.tpePaymentActive = conf.tpe_payment_active === true;
      this.minimumCbAmount = conf.minimum_cb_amount ?? null;
      if (this.tpePaymentActive && this.quickSaleTpeEnabled) {
        void this.shopInit.initTPE(true).catch(error => {
          console.error('[FeesCollector] TPE initialization failed', error);
          this.toastService.showError('TPE', 'Impossible d’initialiser le terminal de paiement.');
        });
      }

    });
    this.tpeSubscriptions.add(this.shopInit.tpeReaderConnected$.subscribe(value => this.tpeReaderConnected = value));
    this.tpeSubscriptions.add(this.shopInit.tpeScanning$.subscribe(value => this.tpeReaderScanning = value));
    this.tpeSubscriptions.add(this.shopInit.tpeReaderLabel$.subscribe(value => this.tpeReaderLabel = value));

    this.membersService.listMembers().subscribe(members => {
      this.members = members;
    });

    this.productService.listProducts().subscribe(products => {
      const card_product = products.find(p => (p.account === 'CAR') && (!p.paired));
      if (!card_product) {
        this.toastService.showError('Configuration produit', `Le produit carte de jeu n'a pas été trouvé. Veuillez le configurer correctement.`);
        throw new Error('Le produit carte de jeu n\'a pas été trouvé. Veuillez le configurer correctement.');
      }
      this.CARD_PRICE = card_product.price;
      this.cardProductId = card_product.id;
      this.cardProductReady = !!card_product.id && card_product.fulfillmentAction === 'CREATE_PLAYBOOK';
    });

    const chrono = (date: string) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tournamentDate = new Date(date);
      if (tournamentDate < today) {
        return 'passed';
      } else if (tournamentDate.toDateString() === today.toDateString()) {
        return 'today';
      } else {
        return 'upcoming';
      }
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.daysBack$.pipe(
      switchMap(v => {
        return this.tournamentService.list_next_tournaments(v, this.tournamentsWindow);
      })
    ).subscribe({
      next: async (tournaments) => {
        const withStatus: club_tournament_extended[] = tournaments.map(t => ({ ...t, chrono: chrono(t.date) }));
        const statuses = await Promise.all(withStatus.map(t => this.feesCollectorService.check_tournament_status(t)));
        withStatus.forEach((t, i) => (t.status = statuses[i]));
        this.next_tournaments = withStatus;
        const previous = this.readOperationalSession();
        this.resumeTournament = !this.selected_tournament && previous
          ? withStatus.find(t => String(t.id) === previous.tournamentId && t.status !== Game_status.COMPLETED) ?? null
          : null;
      },
      error: (err) => {
        this.toastService.showError('connexion au serveur FFB', `Erreur \`${err}\` lors de la récupération des tournois`);
        if (typeof window !== 'undefined' && window.console) {
          console.error('Erreur lors du chargement des tournois :', err);
        }
        this.next_tournaments = [];
      }
    });
  }

  // tooltips are provided by NgbTooltip via the template directive

  ngOnInit() {
    this.breakingNewsService.activate(); // Show banner when this page is active

    this.selected_tournament = this.feesCollectorService.get_tournament();  // persisté par le cache service
    if (this.selected_tournament) this.restoreOperationalMode(this.selected_tournament.id);
    this.hideValidated = this.feesCollectorService.get_view_preferences().hideValidated;

    this.feesCollectorService.game$.subscribe((game) => {
      if (this.selected_tournament) {   // true new game$ generated by selection of tournament
        const tournamentChanged = this.game?.tournament?.id !== game.tournament?.id;
        if (tournamentChanged) this.clearManualConfirmation();
        const wasHidingValidated = this.hideValidated;
        this.game = game;
        const allGamersValidated = game.gamers?.length > 0 && game.gamers.every(gamer => gamer.validated);
        if (this.selected_tournament.status === Game_status.COMPLETED || allGamersValidated) {
          this.hideValidated = this.feesCollectorService.set_hide_validated(false);
        } else {
          this.hideValidated = this.feesCollectorService.get_view_preferences().hideValidated;
        }
        if (tournamentChanged || !wasHidingValidated || !this.hideValidated) {
          this.visibleGamerLicenses.clear();
        }
        if (this.hideValidated) {
          this.game.gamers.filter(gamer => !gamer.validated)
            .forEach(gamer => this.visibleGamerLicenses.add(gamer.license));
        }
        setTimeout(() => this.updateCompactFooterVisibility());
        // console.log('Game updated from service for tournament ', this.game);
      }
    });
    this.zone.runOutsideAngular(() => {
      this.advanceSyncTimer = setInterval(() => this.zone.run(() => void this.syncAdvanceData()), 15_000);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.tpeSubscriptions.unsubscribe();
    if (this.advanceSyncTimer) clearInterval(this.advanceSyncTimer);
    this.clearManualConfirmation();
    this.breakingNewsService.deactivate(); // Hide banner when leaving page
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateCompactFooterVisibility());
  }

  onGamersScroll(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    this.compactFooterVisible = this.computeIsAtBottom(target);
  }

  private updateCompactFooterVisibility(): void {
    const el = this.feesGamersScroll?.nativeElement;
    if (!el) {
      return;
    }
    const atBottom = this.computeIsAtBottom(el);
    if (atBottom !== this.compactFooterVisible) {
      this.compactFooterVisible = atBottom;
    }
  }

  private computeIsAtBottom(el: HTMLElement): boolean {
    const maxScrollable = el.scrollHeight - el.clientHeight;
    if (maxScrollable <= 2) {
      return true;
    }
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
  }


  async set_tournament(tournament: club_tournament_extended): Promise<void> {
    this.clearManualConfirmation();
    this.resumeTournament = null;
    this.restoreOperationalMode(tournament.id);
    this.selected_tournament = tournament;
    await this.feesCollectorService.set_tournament(tournament);
    this.saveOperationalSession();
    if (tournament.status === this.GAME_STATUS.RECOVERED) {
      const modalRef = this.modalService.open(GetConfirmationComponent, { centered: true });
      modalRef.componentInstance.title = 'Pointage existant';
      modalRef.componentInstance.subtitle = 'Un pointage a été retrouvé pour ce tournoi.';
      modalRef.componentInstance.message = 'Que souhaitez-vous faire ?';
      modalRef.componentInstance.confirmLabel = 'Effacer et recommencer';
      modalRef.componentInstance.cancelLabel = 'Reprendre le pointage';
      modalRef.componentInstance.confirmButtonClass = 'btn-outline-danger';
      modalRef.componentInstance.cancelButtonClass = 'btn-primary';
      modalRef.componentInstance.confirmFirst = false;
      modalRef.result.then(async (answer: boolean) => {
        if (answer) {
          const reset = await this.feesCollectorService.reset_tournament_state(tournament);
          if (!reset) return;
          this.next_tournaments.map(t => {
            if (t.id === this.selected_tournament?.id) {
              t.status = Game_status.INITIAL;
            }
          });
          this.toastService.showSuccess('Gestion tournoi', 'Le pointage a été effacé. Vous pouvez recommencer.');
        } else {
          this.toastService.showInfo('Gestion tournoi', 'Le pointage existant a été restauré.');
          this.check_status();
        }
      });
    }
  }

  private readOperationalSession(): OperationalSession | null {
    try {
      const saved = sessionStorage.getItem(COLLECTOR_SESSION_KEY);
      if (!saved) return null;
      const session: { tournamentId?: string; mode?: string } = JSON.parse(saved);
      if (typeof session.tournamentId !== 'string'
        || (session.mode !== 'classic' && session.mode !== 'nfc' && session.mode !== 'nfc-two' && session.mode !== 'nfc-one')) {
        throw new Error('Invalid saved operational session');
      }
      return { tournamentId: session.tournamentId, mode: session.mode === 'classic' ? 'classic' : 'nfc' };
    } catch (error) {
      console.error('[FeesCollector] Unable to restore operational mode', error);
      this.toastService.showWarning('Mode de pointage', 'Le mode précédent n’a pas pu être restauré. Vérifiez le mode sélectionné.');
      return null;
    }
  }

  private restoreOperationalMode(tournamentId: number | string): void {
    const session = this.readOperationalSession();
    this.operationalMode = session?.tournamentId === String(tournamentId) ? session.mode : 'classic';
  }

  private saveOperationalSession(): void {
    if (!this.selected_tournament) return;
    try {
      sessionStorage.setItem(COLLECTOR_SESSION_KEY, JSON.stringify({
        tournamentId: String(this.selected_tournament.id), mode: this.operationalMode,
      }));
    } catch (error) {
      console.error('[FeesCollector] Unable to persist operational mode', error);
      this.toastService.showWarning('Mode de pointage', 'Le mode ne pourra pas être restauré après un rechargement.');
    }
  }

  async changeOperationalMode(mode: OperationalMode): Promise<void> {
    if (mode === this.operationalMode || this.changingOperationalMode || this.quickSaleModalOpen
      || this.quickSaleSaving || this.pairChangePending || this.pendingCheckIns.size > 0) return;
    if (mode !== 'classic' && !this.nfcCheckInEnabled) {
      this.toastService.showWarning('Mode de pointage', 'Activez le pointage NFC dans la configuration avant de choisir ce mode.');
      return;
    }
    const modal = this.modalService.open(GetConfirmationComponent, { centered: true, backdrop: 'static', keyboard: false });
    modal.componentInstance.title = 'Changer de mode de pointage';
    modal.componentInstance.message = mode === 'classic'
      ? 'Le pointage NFC sera arrêté. Les pointages déjà enregistrés seront conservés.'
      : 'Les pointages déjà enregistrés seront conservés. Le pointage NFC pourra démarrer sur ce poste.';
    modal.componentInstance.confirmLabel = 'Changer de mode';
    modal.componentInstance.cancelLabel = 'Annuler';
    this.changingOperationalMode = true;
    try {
      if (!await modal.result) return;
      if (mode === 'classic' && this.nfcControl && !await this.nfcControl.stopForModeChange()) {
        this.toastService.showWarning('Mode de pointage', 'Attendez la fin de l’opération NFC avant de changer de mode.');
        return;
      }
      this.clearManualConfirmation();
      this.operationalMode = mode;
      this.saveOperationalSession();
    } finally {
      this.changingOperationalMode = false;
      this.resumeDeferredCheckStatus();
    }
  }

  onOperationalModeChange(event: Event, mode: OperationalMode): void {
    event.preventDefault();
    void this.changeOperationalMode(mode);
  }

  get protectCollectorExit(): boolean {
    return !!this.selected_tournament && this.selected_tournament.status !== Game_status.COMPLETED;
  }

  canLeave(): boolean {
    if (this.quickSaleSaving || this.quickSalePaidEntryId || this.changingOperationalMode || this.protectCollectorExit) {
      this.toastService.showWarning('Pointage en cours', 'Clôturez le tournoi ou suspendez explicitement le pointage avant de quitter.');
      return false;
    }
    return true;
  }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.protectCollectorExit || this.quickSaleSaving || this.quickSalePaidEntryId || this.changingOperationalMode) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  async suspendCollector(): Promise<void> {
    if (!this.protectCollectorExit || this.quickSaleModalOpen || this.quickSaleSaving
      || this.changingOperationalMode || this.pendingCheckIns.size || this.pairChangePending) return;
    const modal = this.modalService.open(GetConfirmationComponent, { centered: true, backdrop: 'static', keyboard: false });
    modal.componentInstance.title = 'Suspendre le pointage';
    modal.componentInstance.message = this.operationalMode === 'nfc'
      ? 'Le pointage NFC sera arrêté. Le tournoi restera ouvert et devra être repris ou clôturé.'
      : 'Le tournoi restera ouvert et devra être repris ou clôturé.';
    modal.componentInstance.confirmLabel = 'Suspendre';
    modal.componentInstance.cancelLabel = 'Continuer le pointage';
    this.changingOperationalMode = true;
    try {
      if (!await modal.result) return;
      if (this.nfcControl && !await this.nfcControl.stopForModeChange()) {
        this.toastService.showWarning('Pointage NFC', 'Attendez la fin de l’opération NFC avant de suspendre.');
        return;
      }
      this.clear_session(true, true);
    } finally {
      this.changingOperationalMode = false;
      this.resumeDeferredCheckStatus();
    }
  }

  private resumeDeferredCheckStatus(): void {
    if (this.checkStatusAfterAdvance && !this.quickSaleModalOpen && this.selected_tournament) {
      this.checkStatusAfterAdvance = false;
      this.check_status();
    }
  }


  get selectedFeeMode(): TournamentFeeMode {
    return feeModeFromConfiguration(this.game.fee_rate, this.game.fees_doubled);
  }

  async feeModeChanged(mode: TournamentFeeMode): Promise<void> {
    const saved = await this.feesCollectorService.changeFeeMode(mode);
    if (saved) await this.log_game_state();
  }

  get paymentPreference(): 'card' | 'euro' {
    return this.feesCollectorService.paymentPreference;
  }

  one_week_back() {
    this.days_back += 7;
    this.daysBack$.next(this.days_back);
  }

  extend_week() {
    this.tournamentsWindow += 7;
    console.log(`[FeesCollector] Extended tournament window to ${this.tournamentsWindow} days`);
    // Force reload with new window
    this.daysBack$.next(this.days_back);
  }

  euros_collected(): number {
    return this.feesCollectorService.euros_collected();
  }
  stamps_collected(): number {
    return this.feesCollectorService.stamps_collected();
  }


  clear_added_player() {
    this.new_player = null; // or this.new_player = undefined;
  }

  check_status() {
    if (this.quickSaleModalOpen || this.changingOperationalMode) {
      this.checkStatusAfterAdvance = true;
      return;
    }
    if (this.selected_tournament && this.selected_tournament.status !== Game_status.COMPLETED && this.all_gamers_validated()) {
      const modalRef = this.modalService.open(GetConfirmationComponent, { centered: true });
      modalRef.componentInstance.title = 'Tous les joueurs sont pointés';
      modalRef.componentInstance.subtitle = 'Cette opération débitera les cartes de parties et créera l’écriture comptable des droits de table.';
      modalRef.componentInstance.message = '';
      modalRef.componentInstance.confirmLabel = 'Valider les droits';
      modalRef.componentInstance.cancelLabel = 'Continuer le pointage';
      modalRef.componentInstance.cancelButtonClass = 'btn-outline-secondary';
      modalRef.result.then(async (answer: boolean) => {
        if (answer) {
          await this.validate_fees();
        }
      });
    } else {
      this.next_tournaments.map(t => {
        if (t.id === this.selected_tournament?.id) {
          t.status = Game_status.RECOVERED;
        }
      });
    }

  }

  clear_session(force = false, preserveSession = false) {
    if (this.quickSaleSaving || (!force && this.protectCollectorExit)) return;
    this.clearManualConfirmation();
    this.checkStatusAfterAdvance = false;
    this.cancelQuickSale();

    this.resumeTournament = preserveSession ? this.selected_tournament : null;
    this.game = null!;
    this.selected_tournament = null!;
    this.feesCollectorService.clear_tournament();
    if (!preserveSession) {
      try { sessionStorage.removeItem(COLLECTOR_SESSION_KEY); }
      catch (error) { console.error('[FeesCollector] Unable to clear operational session', error); }
    }
  }

  setAlphabeticSort(alphabeticSort: boolean): void {
    this.feesCollectorService.set_alphabetic_sort(alphabeticSort);
  }

  setValidatedFilter(hideValidated: boolean): void {
    this.visibleGamerLicenses = new Set(
      this.game.gamers.filter(gamer => !gamer.validated).map(gamer => gamer.license),
    );
    this.hideValidated = this.feesCollectorService.set_hide_validated(hideValidated);
  }

  shouldShowGamer(gamer: Gamer): boolean {
    return !this.hideValidated || !gamer.validated || this.visibleGamerLicenses.has(gamer.license);
  }

  async setGamerPayment(gamer: Gamer, mode: 'card' | 'euro' | 'none'): Promise<void> {
    if (this.changingOperationalMode || this.pendingCheckIns.has(gamer.license)) return;
    const generation = this.manualConfirmationGeneration;
    const tournamentId = this.selected_tournament?.id;
    this.pendingCheckIns.add(gamer.license);
    try {
      const saved = await this.feesCollectorService.setGamerPayment(gamer, mode, 'manual');
      if (!saved) return;
      if (this.destroyed || tournamentId == null || this.selected_tournament?.id !== tournamentId
        || this.game?.tournament?.id !== tournamentId || this.manualConfirmationGeneration !== generation) return;
      window.clearTimeout(this.manualConfirmationTimer);
      this.manualCheckInConfirmation = { gamer, alreadyCheckedIn: false };
      this.manualConfirmationTimer = window.setTimeout(() => {
        this.manualCheckInConfirmation = null;
        this.manualConfirmationTimer = undefined;
      }, 3000);
      this.check_status();
    } finally {
      this.pendingCheckIns.delete(gamer.license);
    }
  }

  async cancelCheckIn(gamer: Gamer): Promise<void> {
    if (this.changingOperationalMode || this.pendingCheckIns.has(gamer.license)) return;
    if (this.manualCheckInConfirmation?.gamer.license === gamer.license) this.clearManualConfirmation(false);
    this.pendingCheckIns.add(gamer.license);
    try {
      await this.feesCollectorService.cancelGamerCheckIn(gamer);
    } finally {
      this.pendingCheckIns.delete(gamer.license);
    }
  }

  private clearManualConfirmation(invalidatePending = true): void {
    window.clearTimeout(this.manualConfirmationTimer);
    this.manualConfirmationTimer = undefined;
    this.manualCheckInConfirmation = null;
    if (invalidatePending) this.manualConfirmationGeneration++;
  }

  canUseCard(gamer: Gamer): boolean {
    return canSelectGameCard(gamer, this.game.fees_doubled);
  }

  displayedGameCredits(gamer: Gamer): number {
    const creditsToDebit = this.selected_tournament?.status !== Game_status.COMPLETED
      && gamer.validated && gamer.enabled && !gamer.in_euro
      ? requiredGameCredits(this.game.fees_doubled)
      : 0;
    return gamer.game_credits - creditsToDebit;
  }

  checkInLabel(gamer: Gamer): string {
    if (!gamer.validated) return 'Pointer';
    return !gamer.enabled ? 'Offert' : gamer.in_euro
      ? `${gamer.price.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`
      : 'Carte';
  }

  async validate_fees(): Promise<boolean> {
    const progressModal = this.modalService.open(SettlementProgressComponent, {
      backdrop: 'static',
      centered: true,
      keyboard: false,
    });
    progressModal.componentInstance.progress$ = this.feesCollectorService.settlementProgress$;
    let saved = false;
    try {
      saved = await this.feesCollectorService.save_fees(() => this.tables_to_pdf());
    } finally {
      progressModal.close();
    }
    if (!saved) return false;
    this.next_tournaments.forEach(t => {
      if (t.id === this.selected_tournament?.id) t.status = Game_status.COMPLETED;
    });
    if (this.selected_tournament) this.selected_tournament.status = Game_status.COMPLETED;
    this.clear_session();
    return true;
  }

  get pairs(): GamerPair[] {
    return gamerPairs(this.game?.gamers ?? []);
  }

  get pairManagementDisabled(): boolean {
    return this.changingOperationalMode || this.pairChangePending || this.feesCollectorService.playersLoading
      || this.selected_tournament?.status === Game_status.COMPLETED
      || this.feesCollectorService.rosterLocked;
  }

  openPairsModal(): void {
    this.showPairList();
    this.pairsModalOpen = true;
  }

  closePairsModal(): void {
    if (this.pairChangePending) return;
    this.pairsModalOpen = false;
    this.showPairList();
  }

  showPairList(): void {
    if (this.pairChangePending) return;
    this.pairEditMode = 'list';
    this.modalErrorMessage = '';
    this.new_pair_player1 = null;
    this.new_pair_player2 = null;
    this.replacementPlayer = null;
    this.replacedPlayer = null;
    this.removedPair = null;
  }

  beginAddPair(): void {
    this.showPairList();
    this.editingRoster = rosterSignature(this.game.gamers);
    this.pairEditMode = 'add';
  }

  beginReplacePlayer(player: Gamer): void {
    this.showPairList();
    this.editingRoster = rosterSignature(this.game.gamers);
    this.replacedPlayer = player;
    this.pairEditMode = 'replace';
  }

  beginRemovePair(pair: GamerPair): void {
    this.showPairList();
    this.editingRoster = rosterSignature(this.game.gamers);
    this.removedPair = pair;
    this.pairEditMode = 'remove';
  }

  pairHasCheckedInPlayers(pair: GamerPair): boolean {
    return pair.players.some(player => player.validated);
  }

  async confirmPairChange(): Promise<void> {
    if (this.pairManagementDisabled) return;
    if (this.pairEditMode === 'add' && (!this.new_pair_player1 || !this.new_pair_player2)) {
      this.modalErrorMessage = 'Sélectionnez les deux joueurs de la paire.';
      return;
    }
    if (this.pairEditMode === 'replace' && (!this.replacedPlayer || !this.replacementPlayer)) {
      this.modalErrorMessage = 'Sélectionnez le remplaçant.';
      return;
    }
    if (this.pairEditMode === 'list' || (this.pairEditMode === 'remove' && !this.removedPair)) return;
    this.pairChangePending = true;
    this.modalErrorMessage = '';
    let saved = false;
    try {
      if (this.pairEditMode === 'add' && this.new_pair_player1 && this.new_pair_player2) {
        saved = await this.feesCollectorService.addPair(this.new_pair_player1, this.new_pair_player2, this.editingRoster);
      } else if (this.pairEditMode === 'replace' && this.replacedPlayer && this.replacementPlayer) {
        saved = await this.feesCollectorService.replacePlayer(this.replacedPlayer.license, this.replacementPlayer, this.editingRoster);
      } else if (this.pairEditMode === 'remove' && this.removedPair) {
        saved = await this.feesCollectorService.removePair(this.removedPair.id, this.editingRoster);
      }
    } finally {
      this.pairChangePending = false;
    }
    if (saved) {
      this.showPairList();
    } else {
      this.modalErrorMessage = 'La modification n’a pas été enregistrée. Consultez le message d’erreur puis revenez à la liste avant de réessayer.';
    }
  }

  quickSale(gamer: Gamer) {
    if (this.changingOperationalMode || this.quickSaleSaving || this.quickSaleModalOpen) return;
    const member = this.membersService.getMemberbyLicense(gamer.license);
    if (!member?.id || !member.license_number) {
      this.toastService.showError('Avance de carte', 'Adhérent ou licence introuvable. Vérifiez sa fiche.');
      return;
    }
    this.quickSaleModalOpen = true;
    this.quickSaleGamer = gamer;
    this.quickSaleForm = {
      titulaire: member,
      cartePartagee: null,
      coTitulaire: null,
      accepted: false,
      mode: null,
      bank: '',
      chequeNo: '',
      takeDebt: true,
      takeAsset: true,
    };
    this.quickSaleError = '';
    this.quickSaleSuccess = false;
    this.quickSaleReservationId = null;
    try {
      const marker = localStorage.getItem(this.quickSaleKey(member));
      this.quickSaleUncertain = marker !== null;
      if (this.quickSaleUncertain) {
        if (marker?.startsWith('{')) {
          const value: unknown = JSON.parse(marker);
          if (value && typeof value === 'object' && 'reservationId' in value
              && typeof value.reservationId === 'string' && value.reservationId) {
            this.quickSaleReservationId = value.reservationId;
          }
        }
        this.toastService.showWarning('Vente de carte', 'Une vente précédente n’a pas été confirmée. Contactez un responsable avant toute nouvelle vente, y compris sur un autre poste.');
      }
    } catch (error) {
      console.error('[FeesCollector] Cannot read advance safety marker', error);
      this.quickSaleUncertain = true;
      this.quickSaleError = 'Stockage du navigateur indisponible : impossible de protéger cette vente.';
    }
    if (!this.quickSaleUncertain) void this.loadQuickSaleBalance(this.quickSaleForm);
  }

  quickSaleModalOpen = false;
  quickSaleGamer: Gamer | null = null;
  quickSaleForm: {
    titulaire: Member; cartePartagee: boolean | null; coTitulaire: Member | null; accepted: boolean;
    mode: PaymentMode | null; bank: string; chequeNo: string; takeDebt: boolean; takeAsset: boolean;
  } | null = null;
  quickSaleError: string = '';
  quickSaleSaving = false;
  quickSaleUncertain = false;
  quickSaleReservationId: string | null = null;
  quickSaleSuccess = false;
  quickSaleBalanceLoading = false;
  quickSaleBalanceReady = false;
  quickSaleDebt = 0;
  quickSaleAsset = 0;
  quickSaleTotalAmount = 0;
  advancePending: GameCardAdvanceRequest | null = null;
  advancePreviousIds: string[] | null = null;
  advancePreviousConfirmed = false;

  private advanceKey(memberId: string): string {
    return `fees-nfc-advance:${memberId}`;
  }

  private openAdvance(member: Member): void {
    this.advancePending = null;
    this.advancePreviousIds = null;
    this.advancePreviousConfirmed = false;
    this.quickSaleUncertain = false;
    try {
      const saved = localStorage.getItem(this.advanceKey(member.id));
      if (!saved) return;
      const value: unknown = JSON.parse(saved);
      if (!value || typeof value !== 'object'
        || !('operationId' in value) || typeof value.operationId !== 'string' || !value.operationId
        || !('gameId' in value) || typeof value.gameId !== 'string'
        || !('season' in value) || typeof value.season !== 'string'
        || !('buyerId' in value) || value.buyerId !== member.id
        || !('productId' in value) || typeof value.productId !== 'string'
        || !('priceCents' in value) || !Number.isSafeInteger(value.priceCents)
        || !('accepted' in value) || value.accepted !== true
        || !('confirmedPreviousAdvanceIds' in value) || !Array.isArray(value.confirmedPreviousAdvanceIds)
        || !value.confirmedPreviousAdvanceIds.every(id => typeof id === 'string')
        || ('coBuyerId' in value && value.coBuyerId !== undefined && typeof value.coBuyerId !== 'string')) {
        throw new Error('Demande enregistrée invalide.');
      }
      this.advancePending = {
        operationId: value.operationId, gameId: value.gameId, season: value.season, buyerId: member.id,
        productId: value.productId, priceCents: Number(value.priceCents), accepted: true,
        confirmedPreviousAdvanceIds: value.confirmedPreviousAdvanceIds,
        ...('coBuyerId' in value && typeof value.coBuyerId === 'string' ? { coBuyerId: value.coBuyerId } : {}),
      };
      if (this.quickSaleForm) {
        this.quickSaleForm.cartePartagee = !!this.advancePending.coBuyerId;
        this.quickSaleForm.coTitulaire = this.members.find(candidate => candidate.id === this.advancePending?.coBuyerId) ?? null;
        this.quickSaleForm.accepted = true;
      }
      if (value.gameId !== this.feesCollectorService.advanceGameId) {
        this.quickSaleUncertain = true;
        this.quickSaleError = 'Une avance non confirmée concerne un autre tournoi. Reprenez ce tournoi pour la vérifier.';
      }
    } catch (error) {
      console.error('[FeesCollector] Cannot restore advance', error);
      this.quickSaleUncertain = true;
      this.quickSaleError = 'La demande d’avance enregistrée est illisible. Contactez un responsable.';
    }
  }

  onAdvanceHoldersChanged(): void {
    this.advancePreviousIds = null;
    this.advancePreviousConfirmed = false;
  }

  private async syncAdvanceData(): Promise<void> {
    if (this.destroyed || !this.selected_tournament
      || this.advanceSyncRunning || this.quickSaleSaving) return;
    this.advanceSyncRunning = true;
    try {
      await this.feesCollectorService.refreshAdvanceData();
      this.advanceSyncFailed = false;
    } catch (error) {
      console.error('[FeesCollector] Advance synchronization failed', error);
      if (!this.advanceSyncFailed) {
        this.toastService.showWarning('Synchronisation des cartes', 'Les cartes et dettes n’ont pas pu être actualisées.');
      }
      this.advanceSyncFailed = true;
    } finally {
      this.advanceSyncRunning = false;
    }
  }

  private async confirmAdvance(): Promise<void> {
    const form = this.quickSaleForm;
    if (!form || this.quickSaleSaving || this.quickSaleUncertain || this.quickSaleSuccess) return;
    if (!this.advancePending && (form.cartePartagee === null || !form.accepted || !this.cardProductId
      || !Number.isFinite(this.CARD_PRICE) || this.CARD_PRICE < 0
      || (form.cartePartagee && (!form.coTitulaire?.id || !form.coTitulaire.license_number
        || form.coTitulaire.id === form.titulaire.id)))) return;
    this.quickSaleSaving = true;
    try {
      if (!this.advancePending) {
        const gameId = this.feesCollectorService.advanceGameId;
        if (!gameId || !this.game?.season) throw new Error('Tournoi non enregistré.');
        if (this.advancePreviousIds === null) {
          const holders = [form.titulaire.id, ...(form.cartePartagee && form.coTitulaire ? [form.coTitulaire.id] : [])];
          const previous = await this.feesCollectorService.previousCardAdvances(holders);
          this.advancePreviousIds = [...new Set(previous.map(item => item.operationId))];
          if (this.advancePreviousIds.length) return;
        }
        if (this.advancePreviousIds.length && !this.advancePreviousConfirmed) return;
        if (!globalThis.crypto?.randomUUID) throw new Error('Identification sécurisée indisponible sur ce navigateur.');
        const request: GameCardAdvanceRequest = {
          operationId: globalThis.crypto.randomUUID(), gameId, season: this.game.season,
          buyerId: form.titulaire.id,
          ...(form.cartePartagee && form.coTitulaire ? { coBuyerId: form.coTitulaire.id } : {}),
          productId: this.cardProductId, priceCents: Math.round(this.CARD_PRICE * 100), accepted: true,
          confirmedPreviousAdvanceIds: this.advancePreviousIds,
        };
        localStorage.setItem(this.advanceKey(form.titulaire.id), JSON.stringify(request));
        this.advancePending = request;
      }
      const result = await this.feesCollectorService.createCardAdvance(this.advancePending);
      await this.feesCollectorService.refreshAdvanceData(result);
      localStorage.removeItem(this.advanceKey(form.titulaire.id));
      this.advancePending = null;
      this.quickSaleSuccess = true;
      this.quickSaleError = '';
      this.toastService.showSuccess('Avance de carte', 'Carte créée et dette enregistrée. Le joueur peut présenter à nouveau son badge.');
    } catch (error) {
      console.error('[FeesCollector] Advance could not be confirmed', error);
      this.quickSaleError = this.advancePending
        ? 'Résultat non confirmé ou synchronisation en attente. Réessayez : la même demande sera reprise.'
        : error instanceof Error ? error.message : 'Impossible de préparer l’avance.';
      this.toastService.showWarning('Avance de carte', this.quickSaleError);
    } finally {
      this.quickSaleSaving = false;
    }
  }

  async loadQuickSaleBalance(form: NonNullable<FeesCollectorComponent['quickSaleForm']>): Promise<void> {
    this.quickSaleBalanceLoading = true;
    this.quickSaleBalanceReady = false;
    try {
      const balance = await this.buyerContext.loadBalance(form.titulaire, true);
      if (this.quickSaleForm !== form) return;
      this.assertQuickSaleBalance(balance.debtAmount, balance.assetAmount);
      this.quickSaleDebt = balance.debtAmount;
      this.quickSaleAsset = balance.assetAmount;
      this.updateQuickSaleTotal();
      this.quickSaleBalanceReady = true;
      this.quickSaleError = '';
    } catch (error) {
      if (this.quickSaleForm !== form) return;
      console.error('[FeesCollector] Cannot load buyer balance', error);
      this.quickSaleError = 'Impossible de vérifier la dette et l’avoir. Réessayez avant de vendre.';
    } finally {
      if (this.quickSaleForm === form) this.quickSaleBalanceLoading = false;
    }
  }

  private assertQuickSaleBalance(debt: number, asset: number): void {
    if (!Number.isFinite(debt) || debt < 0 || !Number.isFinite(asset) || asset < 0) {
      throw new Error('Solde invalide');
    }
  }

  updateQuickSaleTotal(): number {
    const form = this.quickSaleForm;
    if (!form) return 0;
    this.quickSaleCart.clearCart();
    this.quickSaleCart.clearStripeTag();
    this.quickSaleCart.setSeller('pointage');
    const name = `${form.titulaire.lastname} ${form.titulaire.firstname}`;
    this.quickSaleCart.setBuyer(name);
    this.quickSaleCart.addToCart({
      product_id: this.cardProductId, product_account: 'CAR', payee: form.titulaire,
      payee_name: name, paied: this.CARD_PRICE,
      paired_with: form.cartePartagee ? form.coTitulaire ?? undefined : undefined,
      paired_name: form.cartePartagee && form.coTitulaire
        ? `${form.coTitulaire.lastname} ${form.coTitulaire.firstname}` : undefined,
    });
    this.quickSaleCart.setDebt(name, this.quickSaleDebt);
    this.quickSaleCart.setAsset(name, this.quickSaleAsset);
    this.quickSaleCart.takeDebt(form.takeDebt);
    this.quickSaleCart.takeAsset(form.takeAsset);
    this.quickSaleTotalAmount = this.quickSaleCart.getCartAmount();
    return this.quickSaleTotalAmount;
  }

  quickSaleNeedsPayment(): boolean {
    return Math.round(this.quickSaleTotalAmount * 100) > 0;
  }

  get quickSaleTpeAvailable(): boolean {
    const request = this.stripeTerminal.sharedRequest$.value;
    return this.quickSaleTpeEnabled && this.tpePaymentActive && this.tpeReaderConnected
      && (request === null || request?.status === 'available');
  }

  private quickSaleKey(member: Member): string {
    return `fees-card-advance:${member.id}`;
  }

  async confirmQuickSale() {
    const form = this.quickSaleForm;
    if (!form || !this.quickSaleGamer || this.quickSaleSaving || this.quickSaleUncertain || this.quickSaleSuccess
      || !this.quickSaleBalanceReady || this.quickSaleBalanceLoading || form.cartePartagee === null
      || (form.cartePartagee && (!form.coTitulaire?.id || !form.coTitulaire.license_number
        || form.coTitulaire.id === form.titulaire.id))) return;
    if (!Number.isFinite(this.CARD_PRICE) || this.CARD_PRICE < 0) {
      this.quickSaleError = 'Le prix de la carte est indisponible. Vérifiez la configuration du produit.';
      return;
    }
    if (!this.cardProductReady) {
      this.quickSaleError = 'Le produit carte doit être configuré pour créer un PlayBook avant toute vente.';
      return;
    }
    const total = this.updateQuickSaleTotal();
    const mode = Math.round(total * 100) === 0 ? PaymentMode.CASH : form.mode;
    if (!mode || (mode === PaymentMode.CHEQUE && (!form.bank || !form.chequeNo.trim()))) return;
    if (mode === PaymentMode.CARD) {
      if (!this.quickSaleTpeAvailable) {
        this.quickSaleError = 'Le terminal de paiement est indisponible.';
        return;
      }
      if (this.minimumCbAmount === null || total < this.minimumCbAmount) {
        this.quickSaleError = this.minimumCbAmount === null
          ? 'Configuration du paiement CB indisponible.'
          : `Montant minimum CB : ${this.minimumCbAmount.toFixed(2)} €.`;
        return;
      }
    }
    this.quickSaleSaving = true;
    let completed = false;
    let writeStarted = false;
    try {
      const balance = await this.buyerContext.loadBalance(form.titulaire, true);
      this.assertQuickSaleBalance(balance.debtAmount, balance.assetAmount);
      if (balance.debtAmount !== this.quickSaleDebt || balance.assetAmount !== this.quickSaleAsset) {
        this.quickSaleDebt = balance.debtAmount;
        this.quickSaleAsset = balance.assetAmount;
        this.updateQuickSaleTotal();
        this.quickSaleError = 'Le solde a changé. Vérifiez le montant actualisé puis confirmez à nouveau.';
        return;
      }
      const key = this.quickSaleKey(form.titulaire);
      if (localStorage.getItem(key) !== null) {
        this.quickSaleUncertain = true;
        this.quickSaleError = 'Une vente en cours ou non confirmée nécessite l’intervention d’un responsable.';
        this.toastService.showWarning('Vente de carte', 'Contactez un responsable avant toute nouvelle vente, y compris sur un autre poste.');
        return;
      }
      localStorage.setItem(key, 'pending');
      writeStarted = true;
      const owners = form.cartePartagee && form.coTitulaire
        ? [form.titulaire, form.coTitulaire] : [form.titulaire];
      this.quickSaleCart.payment = {
        mode,
        amount: total, payer_id: form.titulaire.id,
        bank: form.bank, cheque_no: form.chequeNo.trim(),
      };
      if (mode === PaymentMode.CARD) {
        this.quickSaleTpeInProgress = true;
        const today = new Date();
        await this.cardSale.start(this.quickSaleCart, form.titulaire, {
          date: today.toISOString().split('T')[0],
          season: this.systemDataService.get_season(today),
        }, {
          onReserved: reservationId => {
            localStorage.setItem(key, JSON.stringify({ reservationId }));
            this.quickSaleReservationId = reservationId;
          },
          onSuccess: bookEntryId => {
            this.quickSaleTpeInProgress = false;
            this.quickSaleSaving = false;
            this.quickSalePaidEntryId = bookEntryId;
            this.quickSaleError = 'Paiement accepté. Vérification de la création de la carte…';
            void this.refreshPaidQuickSale();
          },
          onFailed: (message, cleanupComplete) => this.finishFailedCardSale(key, message, cleanupComplete),
          onCancelled: cleanupComplete => this.finishFailedCardSale(key, 'Paiement annulé.', cleanupComplete),
          onTimeout: () => this.finishFailedCardSale(key, 'Le TPE ne répond pas. Paiement annulé.', true),
          onError: () => this.finishFailedCardSale(key, 'Résultat du paiement non confirmé. Contactez un responsable avant tout nouvel essai.', false),
        }, 'pointage');
        return;
      }
      await this.feesCollectorService.create_game_card_cart_sale(owners, this.quickSaleCart);
      this.quickSaleSuccess = true;
      this.quickSaleError = '';
      localStorage.removeItem(key);
      completed = true;
    } catch (error) {
      console.error('[FeesCollector] Card sale could not be confirmed', error);
      if (!writeStarted) {
        this.quickSaleError = 'Impossible de vérifier le solde ou de protéger la vente. Aucun enregistrement lancé.';
        this.toastService.showError('Vente de carte', this.quickSaleError);
        return;
      }

      this.quickSaleUncertain = true;
      this.quickSaleError = this.quickSaleSuccess
        ? 'Vente confirmée, mais le marqueur de sécurité n’a pas pu être effacé.'
        : error instanceof Error ? error.message : 'La vente n’a pas pu être confirmée.';
      this.toastService.showWarning('Vente de carte', this.quickSaleSuccess
        ? 'La vente est confirmée, mais le blocage local reste actif. Contactez un responsable.'
        : 'La vente n’a pas été confirmée. Contactez un responsable avant toute nouvelle vente, y compris sur un autre poste.');
    } finally {
      if (!this.quickSaleTpeInProgress && !this.quickSalePaidEntryId) this.quickSaleSaving = false;
    }
    if (completed) {
      this.cancelQuickSale();
      this.toastService.showSuccess('Vente de carte', 'Vente enregistrée et carte créée.');
    }
  }

  private finishFailedCardSale(key: string, message: string, cleanupComplete: boolean): void {
    this.quickSaleTpeInProgress = false;
    this.quickSaleSaving = false;
    this.quickSaleError = message;
    if (cleanupComplete) {
      try {
        localStorage.removeItem(key);
        return;
      } catch (error) {
        console.error('[FeesCollector] Unable to clear sale marker', error);
      }
    }
    this.quickSaleUncertain = true;
    this.toastService.showWarning('Vente de carte', 'Le résultat ou le nettoyage doit être vérifié avant une nouvelle vente.');
  }

  async recoverQuickSale(): Promise<void> {
    const reservationId = this.quickSaleReservationId;
    const form = this.quickSaleForm;
    if (!reservationId || !form || this.quickSaleSaving) return;
    this.quickSaleSaving = true;
    try {
      const result = await this.stripeTerminal.getSharedTpeResult(reservationId);
      if (!result) {
        this.quickSaleError = 'Résultat pas encore disponible. Vérifiez le TPE avant de réessayer.';
        return;
      }
      if (result.buyerMemberId !== form.titulaire.id) throw new Error('Titulaire du paiement incohérent.');
      if (result.status === 'success') {
        if (!result.bookEntryId) throw new Error('Écriture de vente introuvable.');
        this.quickSalePaidEntryId = result.bookEntryId;
        this.quickSaleUncertain = false;
      } else {
        localStorage.removeItem(this.quickSaleKey(form.titulaire));
        this.quickSaleReservationId = null;
        this.quickSaleUncertain = false;
        this.quickSaleError = 'Paiement annulé : vous pouvez reprendre la vente.';
        void this.loadQuickSaleBalance(form);
      }
    } catch (error) {
      console.error('[FeesCollector] Unable to recover TPE sale', error);
      this.quickSaleError = 'Résultat de la vente impossible à vérifier. Contactez un responsable.';
    } finally {
      this.quickSaleSaving = false;
    }
    if (this.quickSalePaidEntryId) await this.refreshPaidQuickSale();
  }

  async refreshPaidQuickSale(): Promise<void> {
    const form = this.quickSaleForm;
    const entryId = this.quickSalePaidEntryId;
    if (!form || !entryId || this.quickSaleSaving) return;
    this.quickSaleSaving = true;
    try {
      if (!await this.feesCollectorService.refreshCardSale(entryId)) {
        this.quickSaleError = 'Paiement accepté : la carte est encore en cours de création. Actualisez avant de faire pointer le joueur.';
        return;
      }
      localStorage.removeItem(this.quickSaleKey(form.titulaire));
      this.quickSalePaidEntryId = null;
      this.quickSaleSuccess = true;
      this.quickSaleError = '';
      this.toastService.showSuccess('Vente de carte', 'Paiement confirmé et carte créée.');
    } catch (error) {
      console.error('[FeesCollector] Unable to confirm paid card', error);
      this.quickSaleError = 'Paiement accepté, mais la carte ne peut pas être vérifiée. Actualisez ou contactez un responsable.';
    } finally {
      this.quickSaleSaving = false;
    }
  }

  async cancelQuickSalePayment(): Promise<void> {
    const form = this.quickSaleForm;
    if (!form || !this.quickSaleTpeInProgress || !this.cardPayment.isRemoteMode) return;
    try {
      await this.cardPayment.cancelRemotePayment();
      this.finishFailedCardSale(this.quickSaleKey(form.titulaire), 'Paiement annulé.', true);
    } catch (error) {
      console.error('[FeesCollector] Unable to cancel TPE payment', error);
      this.finishFailedCardSale(this.quickSaleKey(form.titulaire),
        'Annulation non confirmée. Contactez un responsable avant tout nouvel essai.', false);
    }
  }

  cancelQuickSale() {
    if (this.quickSaleSaving || this.quickSalePaidEntryId) return;
    this.quickSaleModalOpen = false;
    this.quickSaleGamer = null;
    this.quickSaleForm = null;
    this.quickSaleError = '';
    this.quickSaleUncertain = false;
    this.quickSaleReservationId = null;
    this.quickSaleSuccess = false;
    this.quickSaleBalanceReady = false;
    this.quickSaleBalanceLoading = false;
    this.advancePending = null;
    this.advancePreviousIds = null;
    this.advancePreviousConfirmed = false;
    if (this.checkStatusAfterAdvance) {
      this.checkStatusAfterAdvance = false;
      this.check_status();
    }
  }

  all_gamers_validated(): boolean {
    return !!this.game?.tournament
      && this.game.gamers.length > 0
      && this.game.gamers.every(gamer => gamer.validated);
  }

  get checkedInCount(): number {
    return this.game?.gamers.filter(gamer => gamer.validated).length ?? 0;
  }

  gamer_solvent(gamer: Gamer): boolean {
    return !gamer.is_member || gamer.in_euro || (gamer.game_credits >= (this.game.fees_doubled ? 2 : 1));
  }

  showMembershipPaymentWarning(gamer: Gamer): boolean {
    if (!gamer.is_member || !membershipPaymentWarningActive(this.membershipPaymentWarningMonth)) {
      return false;
    }

    const normalizedLicense = gamer.license.padStart(8, '0');
    const member = this.members.find(candidate =>
      candidate.id === gamer.member_id
      || candidate.license_number.padStart(8, '0') === normalizedLicense
    );
    if (!member) return false;

    return !this.membersService.hasPaidMembership(member, this.systemDataService.get_today_season());
  }

  membershipPaymentWarningClass(): string {
    return membershipPaymentWarningLevel(this.membershipPaymentWarningMonth) === 'danger'
      ? 'text-danger'
      : 'text-warning';
  }

  gamer_class(gamer: Gamer): string {
    return `card h-100 fee-player-card${gamer.validated ? ' is-checked-in' : ''}`;
  }

  async log_game_state() {
    if (this.selected_tournament && this.selected_tournament.status === Game_status.COMPLETED) return;
    await this.feesCollectorService.log_game_state();
  }

  isBirthday(gamer: Gamer): boolean {
    if (!gamer.my_birthday || !this.game?.tournament?.date) {
      return false;
    }
    const birthdayDate = new Date(gamer.my_birthday);
    const tournamentDate = new Date(this.game.tournament.date);
    return birthdayDate.getMonth() === tournamentDate.getMonth() &&
           birthdayDate.getDate() === tournamentDate.getDate();
  }

  private to_csv(filename: string, rows: string[]) {
    const csvContent = rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private csvPairRows(): string[] {
    if (!this.game) return [];
    return this.pairs.map(pair => `${pair.players[0]?.license ?? ''};${pair.players[1]?.license ?? ''}`);
  }

  csvListPairCounts(): { a: number; b: number } {
    const pairCount = this.pairs.length;
    const a = Math.ceil(pairCount / 2);
    return { a, b: pairCount - a };
  }

  private csvFilenamePrefix(): string {
    return this.game?.tournament?.date?.split('T')[0] ?? 'tournoi';
  }

  export_csv_a() {
    const rows = this.csvPairRows();
    const { a } = this.csvListPairCounts();
    this.to_csv(`${this.csvFilenamePrefix()}_demie_liste_A_${a}_paires`, rows.slice(0, a));
  }

  export_csv_b() {
    const rows = this.csvPairRows();
    const { a } = this.csvListPairCounts();
    const listB = rows.slice(a);
    this.to_csv(`${this.csvFilenamePrefix()}_demie_liste_B_${listB.length}_paires`, listB);
  }

  export_csv_all() {
    const rows = this.csvPairRows();
    this.to_csv(`${this.csvFilenamePrefix()}_${rows.length}_paires`, rows);
  }

  export_csv_files() {
    this.export_csv_all();
    this.export_csv_a();
    this.export_csv_b();
  }

  // PDF generation 


  sales_of_the_day_table: PDF_table = {
    title: '',
    headers: [],
    alignments: [],
    rows: []
  };

  downloadTournamentPdf() {
    this.pdfLoading = true;
    setTimeout(() => {
      this.tables_to_pdf();
      this.pdfLoading = false;
    }, 100);
  }



  tables_to_pdf() {

    const gamers_table = this.build_gamers_table();

    let fname = this.game.tournament
      ? `${this.game.tournament.date}_${this.game.tournament.name}.pdf`
      : 'feuille_presence.pdf';


    this.pdfService.generateTablePDF([gamers_table, this.sales_of_the_day_table], fname);

  }

  build_gamers_table(): PDF_table {

    let payment = (gamer: Gamer) => {
      if (!gamer.validated) return '';
      if (gamer.enabled) {
        return gamer.in_euro ? (gamer.price.toFixed(2) + ' €') : ((this.game.fees_doubled ? 2 : 1) + ' tampon(s)');
      } else {
        return 'non payant';
      }
    }

    if (!this.game || !this.game.gamers) return { title: '', headers: [], alignments: [], rows: [] };
    const title = 'recettes : ' + this.stamps_collected() + ' tampon(s) et ' + this.euros_collected() + ' €';
    const headers = ['Joueur1', 'Paiement1', 'Joueur2', 'Paiement2'];
    const alignments: HorizontalAlignment[] = ['left', 'right', 'left', 'right'];
    const rows: any[] = [];
    for (let i = 0; i < this.game.gamers.length; i += 2) {
      const gamer1 = this.game.gamers[i];
      const gamer2 = this.game.gamers[i + 1];
      rows.push([
        gamer1 ? gamer1.lastname + ' ' + gamer1.firstname : '',
        gamer1 ? payment(gamer1) : '',
        gamer2 ? gamer2.lastname + ' ' + gamer2.firstname : '',
        gamer2 ? payment(gamer2) : ''
      ]);
    }
    return { title, headers, alignments, rows };
  }

}
