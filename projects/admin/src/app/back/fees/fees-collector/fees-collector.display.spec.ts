import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { TournamentService } from '../../../common/services/tournament.service';
import { MembersService } from '../../../common/services/members.service';
import { MemberNfcCardService } from '../../../common/services/member-nfc-card.service';
import { PdfService } from '../../../common/services/pdf.service';
import { SystemDataService } from '../../../common/services/system-data.service';
import { ToastService } from '../../../common/services/toast.service';
import { ProductService } from '../../../common/services/product.service';
import { BreakingNewsService } from '../../breaking-news/breaking-news.service';
import { FEE_RATE, Game, Gamer, Game_status } from '../fees.interface';
import { FeesCollectorComponent } from './fees-collector.component';
import { FeesCollectorService } from './fees-collector.service';
import { FFB_proxyService } from '../../../common/ffb/services/ffb.service';
import { ClubMember } from '../../../common/ffb/interface/club-member.interface';
import { Member } from '../../../common/interfaces/member.interface';
import { rosterSignature } from './fees-pairs.util';
import { PaymentMode } from '../../shop/cart/cart.interface';
import { CartService } from '../../shop/cart/cart.service';
import { BuyerContextService } from '../../shop/services/buyer-context.service';
import { BookService } from '../../services/book.service';
import { GameCardService } from '../../services/game-card.service';
import { ShopInitializationService } from '../../shop/services/shop-initialization.service';
import { CardPaymentOrchestratorService } from '../../services/card-payment-orchestrator.service';
import { CardSaleService } from '../../services/card-sale.service';

describe('FeesCollectorComponent player cards', () => {
  function quickSaleDependencies(debt = 0, asset = 0) {
    return {
      quickSaleCart: new CartService({} as BookService, jasmine.createSpyObj('ProductService', ['getProduct']), {} as GameCardService),
      buyerContext: { loadBalance: jasmine.createSpy().and.resolveTo({ debtAmount: debt, assetAmount: asset }) },
      cardProductId: 'card-product',
      cardProductReady: true,
    };
  }

  it('renders progress, player status and the quick-sale action without selecting a payment', async () => {
    registerLocaleData(localeFr);
    const gamer: Gamer = {
      license: '00000001', firstname: 'Jean', lastname: 'DUPONT', is_member: true,
      game_credits: 0, debt: 2, credit: 0, index: 0, in_euro: false, price: 3,
      validated: false, enabled: true, photo_url$: null, member_id: '1', my_birthday: null,
    };
    const game: Game = {
      season: '2026', fee_rate: FEE_RATE.STANDARD, member_trn_price: 3,
      non_member_trn_price: 5, fees_doubled: false, alphabetic_sort: false,
      tournament: { id: 1, name: 'Tournoi', date: '2026-11-15', time: '14:00' },
      gamers: [gamer, { ...gamer, index: 1, license: '00000002', firstname: 'Anne', validated: true, enabled: false }],
    };
    let hideValidated = false;
    const configuration$ = new BehaviorSubject({
      banks: [], membership_payment_warning_month: 12, nfc_check_in_active: false,
    });
    const bridge = jasmine.createSpyObj<MemberNfcCardService>('MemberNfcCardService', ['status', 'acquire']);
    const modal = { open: jasmine.createSpy('open') };
    bridge.status.and.resolveTo({
      version: '1.0', readerStatus: 'Ready', readerName: 'ACR1555U', message: '', capturing: false,
    });
    const feesService = {
      game$: new BehaviorSubject(game),
      get_tournament: () => ({ id: 1, status: Game_status.RECOVERED }),
      get_view_preferences: () => ({ hideValidated }),
      set_hide_validated: (hidden: boolean) => hideValidated = hidden,
      stamps_collected: () => 0,
      euros_collected: () => 0,
      paymentPreference: 'card',
      nfcCheckInEnabled: true,
      setGamerPayment: jasmine.createSpy().and.resolveTo(true),
      cancelGamerCheckIn: jasmine.createSpy().and.resolveTo(true),
      addPair: jasmine.createSpy().and.resolveTo(true),
      replacePlayer: jasmine.createSpy().and.resolveTo(true),
      removePair: jasmine.createSpy().and.resolveTo(true),
    };
    await TestBed.configureTestingModule({
      imports: [FeesCollectorComponent],
      providers: [
        { provide: FeesCollectorService, useValue: feesService },
        { provide: TournamentService, useValue: { list_next_tournaments: () => of([]) } },
        { provide: MembersService, useValue: {
          listMembers: () => of([]),
          getMemberbyLicense: () => ({ id: '1', firstname: 'Jean', lastname: 'DUPONT', license_number: '00000001' }),
        } },
        { provide: MemberNfcCardService, useValue: bridge },
        { provide: SystemDataService, useValue: { get_configuration: () => configuration$ } },
        { provide: ProductService, useValue: { listProducts: () => of([{ account: 'CAR', paired: false, price: 10 }]) } },
        { provide: BreakingNewsService, useValue: { activate: () => {}, deactivate: () => {} } },
        { provide: PdfService, useValue: {} },
        { provide: NgbModal, useValue: modal },
        { provide: ToastService, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: FFB_proxyService, useValue: {} },
        { provide: BookService, useValue: {} },
        { provide: GameCardService, useValue: {} },
        { provide: BuyerContextService, useValue: { loadBalance: () => Promise.resolve({ debtAmount: 2, assetAmount: 0 }) } },
        { provide: ShopInitializationService, useValue: {
          tpeReaderConnected$: of(false), tpeReaderLabel$: of(''), initTPE: () => Promise.resolve(),
        } },
        { provide: CardPaymentOrchestratorService, useValue: { isRemoteMode: true } },
        { provide: CardSaleService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(FeesCollectorComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-fees-nfc-control')).toBeNull();
    const radios = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[name="operationalMode"]');
    expect(radios.length).toBe(2);
    expect(radios[0].checked).toBeTrue();
    expect(radios[1].disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('#nfcModeDisabled').textContent).toContain('configuration');
    configuration$.next({ banks: [], membership_payment_warning_month: 12, nfc_check_in_active: true });
    fixture.detectChanges();
    modal.open.and.returnValue({ componentInstance: {}, result: Promise.resolve(false) });
    radios[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(radios[0].checked).toBeTrue();
    expect(radios[1].checked).toBeFalse();
    modal.open.and.returnValue({ componentInstance: {}, result: Promise.resolve(true) });
    radios[1].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(radios[1].checked).toBeTrue();
    expect(fixture.componentInstance.operationalMode).toBe('nfc');
    const nfcSale = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.quick-sale-btn')!;
    expect(nfcSale.disabled).toBeFalse();
    expect(nfcSale.querySelector('.bi-cart-fill')).not.toBeNull();
    const headerSuspend = fixture.nativeElement.querySelector('.fees-collector-header button.btn-outline-warning') as HTMLButtonElement;
    const footerSuspend = fixture.nativeElement.querySelector('.fees-collector-footer button.btn-outline-warning') as HTMLButtonElement;
    expect(headerSuspend.textContent).toContain('Suspendre le pointage');
    expect(headerSuspend.disabled).toBeFalse();
    expect(footerSuspend.parentElement!.querySelectorAll('button').length).toBe(1);
    expect(getComputedStyle(footerSuspend.closest('.fees-collector-footer')!).position).toBe('sticky');
    expect(getComputedStyle(footerSuspend.parentElement!).display).not.toBe('none');
    fixture.componentInstance.operationalMode = 'classic';
    sessionStorage.removeItem('fees-collector.operational-session');
    configuration$.next({ banks: [], membership_payment_warning_month: 12, nfc_check_in_active: false });
    fixture.detectChanges();
    fixture.componentInstance.operationalMode = 'nfc';
    configuration$.next({ banks: [], membership_payment_warning_month: 12, nfc_check_in_active: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-fees-nfc-control')).not.toBeNull();
    configuration$.next({ banks: [], membership_payment_warning_month: 12, nfc_check_in_active: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-fees-nfc-control')).toBeNull();
    fixture.componentInstance.operationalMode = 'classic';

    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.fee-player-card'));
    expect(fixture.nativeElement.querySelector('.fee-progress').textContent).toContain('1 / 2 pointés');
    for (const [credits, label] of [[0, '0 crédit'], [1, '1 crédit'], [2, '2 crédits']] as const) {
      gamer.game_credits = credits;
      fixture.detectChanges();
      expect(cards[0].querySelector('.fee-credit-badge')!.textContent!.trim()).toBe(label);
    }
    gamer.game_credits = 3;
    gamer.validated = true;
    fixture.detectChanges();
    expect(cards[0].querySelector('.fee-credit-badge')!.textContent!.trim()).toBe('2 crédits');
    game.fees_doubled = true;
    fixture.detectChanges();
    expect(cards[0].querySelector('.fee-credit-badge')!.textContent!.trim()).toBe('1 crédit');
    fixture.componentInstance.selected_tournament!.status = Game_status.COMPLETED;
    fixture.detectChanges();
    expect(cards[0].querySelector('.fee-credit-badge')!.textContent!.trim()).toBe('3 crédits');
    fixture.componentInstance.selected_tournament!.status = Game_status.RECOVERED;
    gamer.in_euro = true;
    fixture.detectChanges();
    expect(cards[0].querySelector('.fee-credit-badge')!.textContent!.trim()).toBe('3 crédits');
    gamer.in_euro = false;
    gamer.enabled = false;
    fixture.detectChanges();
    expect(cards[0].querySelector('.fee-credit-badge')!.textContent!.trim()).toBe('3 crédits');
    gamer.validated = false;
    gamer.enabled = true;
    game.fees_doubled = false;
    gamer.game_credits = 0;
    fixture.detectChanges();
    expect(cards[0].textContent).toContain('Dette');
    expect(cards[0].querySelector('.quick-sale-btn')).not.toBeNull();
    expect(cards[1].classList.contains('is-checked-in')).toBeTrue();
    expect(cards[1].querySelector('.fee-checkin-button')!.textContent!.trim()).toBe('Offert');
    expect(cards[1].querySelector('.quick-sale-btn')).toBeNull();

    feesService.paymentPreference = 'euro';
    cards[0].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    await Promise.resolve();
    fixture.detectChanges();
    const confirmation = fixture.nativeElement.querySelector('.confirmation') as HTMLElement;
    expect(confirmation.textContent).toContain('Pointage confirmé');
    expect(confirmation.textContent).toContain('Jean DUPONT');
    expect(getComputedStyle(confirmation.parentElement!).position).toBe('fixed');
    expect(getComputedStyle(confirmation.parentElement!).pointerEvents).toBe('none');
    expect(confirmation.getBoundingClientRect().width).toBeGreaterThan(200);
    await fixture.componentInstance.cancelCheckIn(gamer);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.confirmation')).toBeNull();
    feesService.paymentPreference = 'card';

    const setPayment = spyOn(fixture.componentInstance, 'setGamerPayment');
    gamer.debt = 0;
    cards[0].querySelector<HTMLButtonElement>('.quick-sale-btn')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.quick-sale-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.quick-sale-panel').textContent).toContain('Mode de paiement');
    const panel = fixture.nativeElement.querySelector('.quick-sale-panel') as HTMLElement;
    expect(panel.querySelectorAll('input[name="quickSalePayment"]').length).toBe(4);
    expect(panel.querySelector<HTMLInputElement>('input[name="quickSalePayment"]:checked')).toBeNull();
    panel.querySelector<HTMLInputElement>('#quickSaleCheque')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.quickSaleForm!.mode).toBe(PaymentMode.CHEQUE);
    expect(panel.querySelector('[aria-label="Banque du chèque"]')).not.toBeNull();
    panel.querySelector<HTMLInputElement>('#quickSaleCredit')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.quickSaleForm!.mode).toBe(PaymentMode.CREDIT);
    expect(panel.querySelector('[aria-label="Banque du chèque"]')).toBeNull();
    fixture.componentInstance.quickSaleSaving = true;
    fixture.detectChanges();
    expect(panel.querySelector<HTMLInputElement>('#quickSaleCash')!.matches(':disabled')).toBeTrue();
    fixture.componentInstance.quickSaleSaving = false;
    fixture.componentInstance.tpePaymentActive = true;
    Object.defineProperty(fixture.componentInstance, 'quickSaleTpeEnabled', { value: true, configurable: true });
    fixture.detectChanges();
    expect(panel.querySelectorAll('input[name="quickSalePayment"]').length).toBe(5);
    const paymentLabels = Array.from(panel.querySelectorAll<HTMLLabelElement>('.quick-sale-payment-option'));
    expect(paymentLabels.every(label => label.textContent!.trim() === '')).toBeTrue();
    expect(paymentLabels.every(label => label.getBoundingClientRect().top === paymentLabels[0].getBoundingClientRect().top)).toBeTrue();
    paymentLabels[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(document.body.querySelector('.tooltip-inner')?.textContent).toContain('Espèces');
    paymentLabels[0].dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(panel.querySelector('#quickSaleCredit + label .bi-journal-bookmark')).not.toBeNull();
    panel.querySelector<HTMLInputElement>('#quickSaleCard')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.quickSaleForm!.mode).toBe(PaymentMode.CARD);
    expect(panel.querySelector<HTMLButtonElement>('.btn-primary')!.disabled).toBeTrue();
    fixture.componentInstance.tpePaymentActive = false;
    Object.defineProperty(fixture.componentInstance, 'quickSaleTpeEnabled', { value: false, configurable: true });
    fixture.componentInstance.quickSaleForm!.mode = null;
    fixture.componentInstance.quickSaleUncertain = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.quick-sale-panel').textContent).not.toContain('J’ai vérifié');
    expect(fixture.nativeElement.querySelector('.quick-sale-panel .btn-primary').disabled).toBeTrue();
    fixture.componentInstance.quickSaleUncertain = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fee-checkin-button')).not.toBeNull();
    expect(fixture.componentInstance.quickSaleGamer).toBe(gamer);
    feesService.paymentPreference = 'euro';
    fixture.detectChanges();
    cards[0].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    expect(setPayment).toHaveBeenCalledOnceWith(gamer, 'euro');
    feesService.paymentPreference = 'card';
    setPayment.calls.reset();
    const checkStatus = spyOn(fixture.componentInstance, 'check_status').and.callThrough();
    fixture.componentInstance.check_status();
    fixture.componentInstance.cancelQuickSale();
    expect(checkStatus).toHaveBeenCalledTimes(2);
    fixture.detectChanges();
    cards[0].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    fixture.detectChanges();
    expect(setPayment).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Offert');
    feesService.paymentPreference = 'euro';
    fixture.detectChanges();
    cards[0].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    expect(setPayment).toHaveBeenCalledOnceWith(gamer, 'euro');
    gamer.game_credits = 10;
    feesService.paymentPreference = 'card';
    fixture.detectChanges();
    setPayment.calls.reset();
    cards[0].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    expect(setPayment).toHaveBeenCalledOnceWith(gamer, 'card');
    feesService.paymentPreference = 'euro';
    fixture.detectChanges();
    setPayment.calls.reset();
    cards[0].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    expect(setPayment).toHaveBeenCalledOnceWith(gamer, 'euro');
    const cancelCheckIn = spyOn(fixture.componentInstance, 'cancelCheckIn');
    cards[1].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    expect(cancelCheckIn).toHaveBeenCalledOnceWith(game.gamers[1]);
    for (const alphabeticSort of [false, true]) {
      game.alphabetic_sort = alphabeticSort;
      fixture.nativeElement.querySelector('#gamerFilterPending').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.fee-player-card').length).toBe(1);
      expect(fixture.nativeElement.querySelector('.fee-player-name').textContent).toContain('Jean');
      feesService.game$.next(game);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.fee-player-card').length).toBe(1);
      game.gamers[1].validated = false;
      feesService.game$.next(game);
      fixture.detectChanges();
      const slots: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.gamer-container'));
      const nextPlayerPosition = slots[1].getBoundingClientRect();
      expect(nextPlayerPosition.height).toBeGreaterThan(0);
      gamer.validated = true;
      feesService.game$.next(game);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.gamer-container').length).toBe(2);
      expect(slots[0].classList.contains('gamer-placeholder')).toBeTrue();
      expect(getComputedStyle(slots[0]).visibility).toBe('hidden');
      expect(slots[0].hasAttribute('inert')).toBeTrue();
      expect(slots[0].getBoundingClientRect().height).toBeGreaterThan(0);
      expect(slots[1].getBoundingClientRect().x).toBe(nextPlayerPosition.x);
      expect(slots[1].getBoundingClientRect().y).toBe(nextPlayerPosition.y);
      gamer.validated = false;
      game.gamers[1].validated = true;
      feesService.game$.next(game);
      fixture.detectChanges();
      expect(slots[0].classList.contains('gamer-placeholder')).toBeFalse();
      expect(slots[0].hasAttribute('inert')).toBeFalse();
      fixture.nativeElement.querySelector('label[for="gamerFilterPending"]').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.gamer-container').length).toBe(1);
      expect(fixture.nativeElement.querySelector('.fee-player-name').textContent).toContain('Jean');
      fixture.nativeElement.querySelector('#gamerFilterAll').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.fee-player-card').length).toBe(2);
    }
    const component = fixture.componentInstance;
    const footerActions = fixture.nativeElement.querySelector('.fees-footer-actions');
    expect(footerActions.querySelectorAll('button').length).toBe(4);
    expect(footerActions.textContent).toContain('pointages');
    const managementButton = footerActions.querySelector('button');
    expect(managementButton.textContent).toContain('Gérer les paires');
    expect(fixture.nativeElement.querySelector('.fees-collector-header').textContent).not.toContain('Ajouter une paire');
    managementButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.fee-pair-row').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.fee-pair-row .btn-outline-danger').disabled).toBeTrue();
    const replacement: ClubMember = {
      id: 3, license_number: '00000003', firstName: 'Paul', lastName: 'MARTIN',
      gender: 'M', birthdate: '', licence: true, season: { id: 1, category: 'senior' },
      mainRegistration: { free: false },
      club: { id: 1, ffbCode: '', name: '', label: '', type: '',
        committee: { id: 1, label: '', zone: { id: 1, label: '' } } },
    };
    fixture.nativeElement.querySelector('[aria-label="Remplacer Jean DUPONT"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-input-player[listeId="replacement_player"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#player1')).toBeNull();
    component.replacementPlayer = replacement;
    await component.confirmPairChange();
    expect(feesService.replacePlayer).toHaveBeenCalledOnceWith(gamer.license, replacement, rosterSignature(game.gamers));
    component.beginAddPair();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-input-player').length).toBe(2);
    await component.confirmPairChange();
    expect(feesService.addPair).not.toHaveBeenCalled();
    component.new_pair_player1 = replacement;
    component.new_pair_player2 = { ...replacement, id: 4, license_number: '00000004' };
    await component.confirmPairChange();
    expect(feesService.addPair).toHaveBeenCalledOnceWith(component.new_pair_player1 ?? replacement,
      jasmine.objectContaining({ id: 4 }), rosterSignature(game.gamers));
    game.gamers[1].validated = false;
    component.beginRemovePair(component.pairs[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert-warning').textContent).toContain('Anne');
    await component.confirmPairChange();
    expect(feesService.removePair).toHaveBeenCalledOnceWith('legacy-0', rosterSignature(game.gamers));
    component.closePairsModal();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-labelledby="pairsModalTitle"]')).toBeNull();
    fixture.destroy();
  });

  it('only confirms successful manual payments and replaces the previous confirmation for three seconds', fakeAsync(() => {
    const gamer = { license: '1', firstname: 'Jean', lastname: 'TEST' } as Gamer;
    const other = { ...gamer, license: '2', firstname: 'Anne' };
    const fees = jasmine.createSpyObj('FeesCollectorService', ['setGamerPayment', 'cancelGamerCheckIn']);
    fees.setGamerPayment.and.resolveTo(true);
    fees.cancelGamerCheckIn.and.resolveTo(true);
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    Object.assign(component, {
      feesCollectorService: fees, pendingCheckIns: new Set<string>(), operationalMode: 'classic',
      selected_tournament: { id: 1 }, game: { tournament: { id: 1 } }, manualConfirmationGeneration: 0,
    });
    spyOn(component, 'check_status');
    for (const mode of ['card', 'euro', 'none'] as const) {
      void component.setGamerPayment(gamer, mode);
      flushMicrotasks();
      expect(fees.setGamerPayment).toHaveBeenCalledWith(gamer, mode, 'manual');
      expect(component.manualCheckInConfirmation?.gamer).toBe(gamer);
    }
    tick(2000);
    void component.setGamerPayment(other, 'euro');
    flushMicrotasks();
    expect(component.manualCheckInConfirmation?.gamer).toBe(other);
    tick(1000);
    expect(component.manualCheckInConfirmation?.gamer).toBe(other);
    tick(2000);
    expect(component.manualCheckInConfirmation).toBeNull();
    fees.setGamerPayment.and.resolveTo(true);
    void component.setGamerPayment(gamer, 'card');
    flushMicrotasks();
    let resolveOther!: (saved: boolean) => void;
    fees.setGamerPayment.and.returnValue(new Promise<boolean>(resolve => { resolveOther = resolve; }));
    void component.setGamerPayment(other, 'euro');
    void component.cancelCheckIn(gamer);
    flushMicrotasks();
    expect(component.manualCheckInConfirmation).toBeNull();
    resolveOther(true);
    flushMicrotasks();
    expect(component.manualCheckInConfirmation?.gamer).toBe(other);
    tick(3000);
    fees.setGamerPayment.and.resolveTo(false);
    void component.setGamerPayment(gamer, 'card');
    flushMicrotasks();
    expect(component.manualCheckInConfirmation).toBeNull();
    void component.cancelCheckIn(gamer);
    flushMicrotasks();
    expect(component.manualCheckInConfirmation).toBeNull();
  }));

  it('does not show a late manual confirmation after the session changes, even for the same tournament', fakeAsync(() => {
    const gamer = { license: '1' } as Gamer;
    let resolvePayment!: (saved: boolean) => void;
    const fees = {
      setGamerPayment: () => new Promise<boolean>(resolve => { resolvePayment = resolve; }),
      clear_tournament: () => {},
    };
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    Object.assign(component, {
      feesCollectorService: fees, pendingCheckIns: new Set<string>(), operationalMode: 'classic',
      selected_tournament: { id: 1 }, game: { tournament: { id: 1 } }, manualConfirmationGeneration: 0,
      quickSaleSaving: false,
    });
    spyOn(component, 'cancelQuickSale');
    spyOn(component, 'check_status');
    void component.setGamerPayment(gamer, 'card');
    component.clear_session(true);
    Object.assign(component, { selected_tournament: { id: 1 }, game: { tournament: { id: 1 } } });
    resolvePayment(true);
    flushMicrotasks();
    expect(component.manualCheckInConfirmation).toBeNull();
    expect(component.check_status).not.toHaveBeenCalled();
  }));

  it('blocks further advances and warns after an unconfirmed outcome', async () => {
    const member = { id: 'advance-test', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
    const gamer = { license: member.license_number, debt: 0, credit: 0 } as Gamer;
    const key = `fees-card-advance:${member.id}`;
    localStorage.removeItem(key);
    let rejectAdvance!: (error: Error) => void;
    const fees = jasmine.createSpyObj('FeesCollectorService', ['create_game_card_cart_sale']);
    const toast = jasmine.createSpyObj('ToastService', ['showError', 'showWarning']);
    fees.create_game_card_cart_sale.and.returnValue(new Promise<void>((_resolve, reject) => rejectAdvance = reject));
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    Object.assign(component, {
      membersService: { getMemberbyLicense: () => member },
      feesCollectorService: fees,
      toastService: toast,
      quickSaleModalOpen: false, quickSaleSaving: false, quickSaleUncertain: false, quickSaleSuccess: false,
      operationalMode: 'classic',
      CARD_PRICE: 30,
      ...quickSaleDependencies(),
    });
    try {
      component.quickSale(gamer);
      await Promise.resolve();
      expect(component.quickSaleForm?.titulaire).toBe(member);
      component.quickSaleForm!.cartePartagee = false;
      await component.confirmQuickSale();
      expect(fees.create_game_card_cart_sale).not.toHaveBeenCalled();
      component.quickSaleForm!.mode = PaymentMode.CREDIT;
      const pending = component.confirmQuickSale();
      await Promise.resolve();
      expect(localStorage.getItem(key)).toBe('pending');
      await component.confirmQuickSale();
      expect(fees.create_game_card_cart_sale).toHaveBeenCalledOnceWith([member], jasmine.any(CartService));
      component.cancelQuickSale();
      expect(component.quickSaleModalOpen).toBeTrue();
      rejectAdvance(new Error('Écriture enregistrée, carte non confirmée'));
      await pending;
      expect(component.quickSaleUncertain).toBeTrue();
      component.cancelQuickSale();
      component.quickSale(gamer);
      expect(component.quickSaleUncertain).toBeTrue();
      await component.confirmQuickSale();
      expect(fees.create_game_card_cart_sale).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(key)).toBe('pending');
      expect(toast.showWarning).toHaveBeenCalled();
    } finally {
      localStorage.removeItem(key);
    }
  });

  it('closes the quick sale after the card is created and its safety marker is cleared', async () => {
    const member = { id: 'advance-success', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
    const key = `fees-card-advance:${member.id}`;
    localStorage.removeItem(key);
    const fees = jasmine.createSpyObj('FeesCollectorService', ['create_game_card_cart_sale']);
    const toast = jasmine.createSpyObj('ToastService', ['showError', 'showSuccess']);
    fees.create_game_card_cart_sale.and.resolveTo();
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    Object.assign(component, {
      membersService: { getMemberbyLicense: () => member },
      feesCollectorService: fees,
      toastService: toast,
      quickSaleModalOpen: false, quickSaleSaving: false, quickSaleUncertain: false, quickSaleSuccess: false,
      operationalMode: 'classic',
      CARD_PRICE: 30,
      ...quickSaleDependencies(),
    });
    try {
      component.quickSale({ license: member.license_number, debt: 0, credit: 0 } as Gamer);
      await Promise.resolve();
      component.quickSaleForm!.cartePartagee = false;
      component.quickSaleForm!.mode = PaymentMode.CASH;
      component.quickSaleForm!.accepted = true;
      await component.confirmQuickSale();
      expect(component.quickSaleModalOpen).toBeFalse();
      expect(component.quickSaleForm).toBeNull();
      expect(toast.showSuccess).toHaveBeenCalled();
      expect(localStorage.getItem(key)).toBeNull();
      expect(fees.create_game_card_cart_sale).toHaveBeenCalledOnceWith([member], jasmine.any(CartService));
    } finally {
      localStorage.removeItem(key);
    }
  });

  it('uses the same quick sale in NFC mode while leaving pointage active', async () => {
    const member = { id: 'nfc-sale', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
    const key = `fees-card-advance:${member.id}`;
    localStorage.removeItem(key);
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    const toast = jasmine.createSpyObj('ToastService', ['showError', 'showSuccess']);
    const fees = jasmine.createSpyObj('FeesCollectorService', ['create_game_card_cart_sale']);
    fees.create_game_card_cart_sale.and.resolveTo();
    Object.assign(component, {
      operationalMode: 'nfc', quickSaleSaving: false, quickSaleModalOpen: false,
      toastService: toast, feesCollectorService: fees, members: [member],
      membersService: { getMemberbyLicense: () => member }, CARD_PRICE: 30,
      ...quickSaleDependencies(),
    });
    try {
      component.quickSale({ license: member.license_number } as Gamer);
      await Promise.resolve();
      component.quickSaleForm!.cartePartagee = false;
      component.quickSaleForm!.mode = PaymentMode.CREDIT;
      await component.confirmQuickSale();
      expect(fees.create_game_card_cart_sale).toHaveBeenCalledOnceWith([member], jasmine.any(CartService));
      expect(localStorage.getItem(key)).toBeNull();
      expect(component.quickSaleModalOpen).toBeFalse();
    } finally {
      localStorage.removeItem(key);
    }
  });

  it('keeps a paid sale pending until the PlayBook is visible', async () => {
      const member = { id: 'tpe-sale', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
      const key = `fees-card-advance:${member.id}`;
      localStorage.removeItem(key);
      const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
      const fees = jasmine.createSpyObj('FeesCollectorService', ['refreshCardSale']);
      fees.refreshCardSale.and.resolveTo(false);
      const cardSale = jasmine.createSpyObj('CardSaleService', ['start']);
      let callbacks!: { onSuccess: (entryId: string) => void };
      cardSale.start.and.callFake(async (_cart: unknown, _buyer: unknown, _session: unknown, handlers: typeof callbacks) => {
        callbacks = handlers;
      });
      Object.assign(component, {
        operationalMode: 'nfc', quickSaleSaving: false, quickSaleModalOpen: false,
        quickSaleTpeInProgress: false, quickSalePaidEntryId: null, quickSaleTpeEnabled: true,
        tpePaymentActive: true, tpeReaderConnected: true, minimumCbAmount: 0,
        stripeTerminal: { sharedRequest$: new BehaviorSubject(null) },
        toastService: jasmine.createSpyObj('ToastService', ['showError', 'showWarning', 'showSuccess']),
        feesCollectorService: fees, cardSale, systemDataService: { get_season: () => '2026/2027' },
        membersService: { getMemberbyLicense: () => member }, CARD_PRICE: 30,
        ...quickSaleDependencies(),
      });
      try {
        component.quickSale({ license: member.license_number } as Gamer);
        await Promise.resolve();
        component.quickSaleForm!.cartePartagee = false;
        component.quickSaleForm!.mode = PaymentMode.CARD;
        await component.confirmQuickSale();
        expect(component.quickSaleTpeInProgress).toBeTrue();
        expect(component.quickSaleSaving).toBeTrue();
        callbacks.onSuccess('entry');
        await Promise.resolve();
        await Promise.resolve();
        expect(component.quickSalePaidEntryId).toBe('entry');
        expect(component.quickSaleError).toContain('en cours de création');
        expect(localStorage.getItem(key)).toBe('pending');
        fees.refreshCardSale.and.resolveTo(true);
        await component.refreshPaidQuickSale();
        expect(component.quickSaleSuccess).toBeTrue();
        expect(localStorage.getItem(key)).toBeNull();
      } finally {
        localStorage.removeItem(key);
      }
  });

  it('recovers a confirmed TPE sale after reopening the pointage', async () => {
    const member = { id: 'recover-tpe', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
    const key = `fees-card-advance:${member.id}`;
    localStorage.setItem(key, JSON.stringify({ reservationId: 'reservation' }));
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    const refreshCardSale = jasmine.createSpy().and.resolveTo(true);
    Object.assign(component, {
      changingOperationalMode: false, quickSaleSaving: false, quickSaleModalOpen: false,
      quickSalePaidEntryId: null,
      membersService: { getMemberbyLicense: () => member },
      toastService: jasmine.createSpyObj('ToastService', ['showWarning', 'showSuccess', 'showError']),
      feesCollectorService: { refreshCardSale },
      stripeTerminal: { getSharedTpeResult: jasmine.createSpy().and.resolveTo({
        reservationId: 'reservation', status: 'success', paymentIntentId: 'pi_1', bookEntryId: 'entry', buyerMemberId: member.id,
      }) },
    });
    try {
      component.quickSale({ license: member.license_number } as Gamer);
      expect(component.quickSaleUncertain).toBeTrue();
      expect(component.quickSaleReservationId).toBe('reservation');
      await component.recoverQuickSale();
      expect(refreshCardSale).toHaveBeenCalledOnceWith('entry');
      expect(component.quickSaleSuccess).toBeTrue();
      expect(localStorage.getItem(key)).toBeNull();
    } finally {
      localStorage.removeItem(key);
    }
  });

  it('keeps the sale panel open when the safety marker cannot be cleared', async () => {
    const member = { id: 'sale-marker-test', license_number: '00000001' } as Member;
    const key = `fees-card-advance:${member.id}`;
    localStorage.removeItem(key);
    const fees = jasmine.createSpyObj('FeesCollectorService', ['create_game_card_cart_sale']);
    fees.create_game_card_cart_sale.and.resolveTo();
    const toast = jasmine.createSpyObj('ToastService', ['showWarning', 'showSuccess']);
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    Object.assign(component, {
      operationalMode: 'classic', quickSaleModalOpen: true, quickSaleSaving: false,
      quickSaleUncertain: false, quickSaleSuccess: false, quickSaleGamer: { license: member.license_number },
      CARD_PRICE: 30, quickSaleForm: { titulaire: member, cartePartagee: false, coTitulaire: null,
        accepted: false, mode: PaymentMode.CASH, bank: '', chequeNo: '', takeDebt: true, takeAsset: true },
      feesCollectorService: fees, toastService: toast,
      quickSaleBalanceReady: true, quickSaleDebt: 0, quickSaleAsset: 0, ...quickSaleDependencies(),
    });
    const remove = spyOn(localStorage, 'removeItem').and.throwError('Storage unavailable');
    try {
      await component.confirmQuickSale();
      expect(component.quickSaleModalOpen).toBeTrue();
      expect(component.quickSaleUncertain).toBeTrue();
      expect(component.quickSaleError).toContain('Vente confirmée');
      expect(toast.showWarning).toHaveBeenCalled();
      expect(toast.showSuccess).not.toHaveBeenCalled();
    } finally {
      remove.and.callThrough();
      localStorage.removeItem(key);
    }
  });

  it('requires cheque details and forwards them for a classic sale', async () => {
    const member = { id: 'cheque-test', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
    const fees = jasmine.createSpyObj('FeesCollectorService', ['create_game_card_cart_sale']);
    fees.create_game_card_cart_sale.and.resolveTo();
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    Object.assign(component, {
      operationalMode: 'classic', quickSaleSaving: false, quickSaleUncertain: false, quickSaleSuccess: false,
      quickSaleGamer: { license: member.license_number }, CARD_PRICE: 30,
      quickSaleForm: { titulaire: member, cartePartagee: false, coTitulaire: null, accepted: false,
        mode: PaymentMode.CHEQUE, bank: '', chequeNo: '', takeDebt: true, takeAsset: true },
      feesCollectorService: fees,
      toastService: jasmine.createSpyObj('ToastService', ['showSuccess']),
      quickSaleBalanceReady: true, quickSaleDebt: 0, quickSaleAsset: 0, ...quickSaleDependencies(),
    });
    const key = `fees-card-advance:${member.id}`;
    localStorage.removeItem(key);
    try {
      await component.confirmQuickSale();
      expect(fees.create_game_card_cart_sale).not.toHaveBeenCalled();
      component.quickSaleForm!.bank = 'BANK';
      component.quickSaleForm!.chequeNo = ' 123 ';
      await component.confirmQuickSale();
      expect(fees.create_game_card_cart_sale).toHaveBeenCalledOnceWith([member], jasmine.any(CartService));
      expect((component as any).quickSaleCart.payment.cheque_no).toBe('123');
      expect((component as any).quickSaleCart.payment.bank).toBe('BANK');
    } finally {
      localStorage.removeItem(key);
    }
  });

  it('updates the displayed balance and requires confirmation again when it changes', async () => {
    const member = { id: 'balance-test', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
    const dependencies = quickSaleDependencies(20, 10);
    dependencies.buyerContext.loadBalance.and.resolveTo({ debtAmount: 25, assetAmount: 10 });
    const fees = jasmine.createSpyObj('FeesCollectorService', ['create_game_card_cart_sale']);
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    Object.assign(component, {
      operationalMode: 'classic', quickSaleSaving: false, quickSaleUncertain: false, quickSaleSuccess: false,
      quickSaleGamer: { license: member.license_number }, CARD_PRICE: 30,
      quickSaleForm: { titulaire: member, cartePartagee: false, coTitulaire: null, accepted: false,
        mode: PaymentMode.CASH, bank: '', chequeNo: '', takeDebt: true, takeAsset: true },
      quickSaleBalanceReady: true, quickSaleDebt: 20, quickSaleAsset: 10,
      feesCollectorService: fees, toastService: jasmine.createSpyObj('ToastService', ['showError']),
      ...dependencies,
    });
    expect(component.updateQuickSaleTotal()).toBe(40);
    await component.confirmQuickSale();
    expect(fees.create_game_card_cart_sale).not.toHaveBeenCalled();
    expect(component.quickSaleTotalAmount).toBe(45);
    expect(component.quickSaleError).toContain('solde a changé');
    component.quickSaleForm!.takeDebt = false;
    component.quickSaleForm!.takeAsset = false;
    expect(component.updateQuickSaleTotal()).toBe(30);
  });

  it('accepts a fully covered sale without requesting a payment mode', async () => {
    const member = { id: 'covered-test', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
    const dependencies = quickSaleDependencies(0, 40);
    const fees = jasmine.createSpyObj('FeesCollectorService', ['create_game_card_cart_sale']);
    fees.create_game_card_cart_sale.and.resolveTo();
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    Object.assign(component, {
      operationalMode: 'classic', quickSaleSaving: false, quickSaleUncertain: false, quickSaleSuccess: false,
      quickSaleGamer: { license: member.license_number }, CARD_PRICE: 30,
      quickSaleForm: { titulaire: member, cartePartagee: false, coTitulaire: null, accepted: false,
        mode: null, bank: '', chequeNo: '', takeDebt: false, takeAsset: true },
      quickSaleBalanceReady: true, quickSaleDebt: 0, quickSaleAsset: 40,
      feesCollectorService: fees, toastService: jasmine.createSpyObj('ToastService', ['showSuccess']),
      ...dependencies,
    });
    const key = `fees-card-advance:${member.id}`;
    localStorage.removeItem(key);
    try {
      await component.confirmQuickSale();
      expect(fees.create_game_card_cart_sale).toHaveBeenCalledOnceWith([member], dependencies.quickSaleCart);
      expect(dependencies.quickSaleCart.payment.mode).toBe(PaymentMode.CASH);
      expect(dependencies.quickSaleCart.payment.amount).toBe(0);
    } finally {
      localStorage.removeItem(key);
    }
  });

  it('does not start a sale when the balance cannot be rechecked', async () => {
    const member = { id: 'balance-error', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
    const dependencies = quickSaleDependencies();
    dependencies.buyerContext.loadBalance.and.rejectWith(new Error('offline'));
    const fees = jasmine.createSpyObj('FeesCollectorService', ['create_game_card_cart_sale']);
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    Object.assign(component, {
      operationalMode: 'classic', quickSaleSaving: false, quickSaleUncertain: false, quickSaleSuccess: false,
      quickSaleGamer: { license: member.license_number }, CARD_PRICE: 30,
      quickSaleForm: { titulaire: member, cartePartagee: false, coTitulaire: null, accepted: false,
        mode: PaymentMode.CASH, bank: '', chequeNo: '', takeDebt: true, takeAsset: true },
      quickSaleBalanceReady: true, quickSaleDebt: 0, quickSaleAsset: 0,
      feesCollectorService: fees, toastService: jasmine.createSpyObj('ToastService', ['showError']),
      ...dependencies,
    });
    const key = `fees-card-advance:${member.id}`;
    localStorage.removeItem(key);
    await component.confirmQuickSale();
    expect(fees.create_game_card_cart_sale).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBeNull();
    expect(component.quickSaleUncertain).toBeFalse();
    expect(component.quickSaleError).toContain('Aucun enregistrement');
  });

  it('waits for NFC to stop before returning to classic mode', async () => {
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    let finish!: (value: boolean) => void;
    const stop = jasmine.createSpy().and.returnValue(new Promise<boolean>(resolve => finish = resolve));
    const modal = { componentInstance: {}, result: Promise.resolve(true) };
    Object.assign(component, {
      operationalMode: 'nfc', nfcCheckInEnabled: true, changingOperationalMode: false,
      quickSaleModalOpen: false, quickSaleSaving: false, pairChangePending: false,
      pendingCheckIns: new Set<string>(), selected_tournament: { id: 987, status: Game_status.RECOVERED },
      modalService: { open: () => modal }, nfcControl: { stopForModeChange: stop },
    });
    const previous = sessionStorage.getItem('fees-collector.operational-session');
    try {
      const switching = component.changeOperationalMode('classic');
      await Promise.resolve();
      expect(stop).toHaveBeenCalled();
      expect(component.operationalMode).toBe('nfc');
      finish(true);
      await switching;
      expect(component.operationalMode).toBe('classic');
      expect(JSON.parse(sessionStorage.getItem('fees-collector.operational-session')!).mode).toBe('classic');
    } finally {
      if (previous === null) sessionStorage.removeItem('fees-collector.operational-session');
      else sessionStorage.setItem('fees-collector.operational-session', previous);
    }
  });

  it('blocks leaving an open tournament in either mode, but not a closed tournament', () => {
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    const toast = jasmine.createSpyObj('ToastService', ['showWarning']);
    Object.assign(component, {
      operationalMode: 'nfc', selected_tournament: { status: Game_status.RECOVERED },
      quickSaleSaving: false, changingOperationalMode: false, toastService: toast,
    });
    expect(component.canLeave()).toBeFalse();
    component.selected_tournament!.status = Game_status.COMPLETED;
    expect(component.canLeave()).toBeTrue();
    component.selected_tournament!.status = Game_status.RECOVERED;
    component.operationalMode = 'classic';
    expect(component.canLeave()).toBeFalse();
  });

  it('suspends only after confirmation and NFC has stopped, preserving the session', async () => {
    const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
    const tournament = { id: 987, status: Game_status.RECOVERED };
    const modal = { componentInstance: {}, result: Promise.resolve(false) };
    const stop = jasmine.createSpy().and.resolveTo(false);
    const clearTournament = jasmine.createSpy();
    const toast = jasmine.createSpyObj('ToastService', ['showWarning']);
    Object.assign(component, {
      operationalMode: 'nfc', selected_tournament: tournament, game: { gamers: [] },
      quickSaleModalOpen: false, quickSaleSaving: false, changingOperationalMode: false,
      pairChangePending: false, pendingCheckIns: new Set<string>(),
      modalService: { open: () => modal }, nfcControl: { stopForModeChange: stop },
      feesCollectorService: { clear_tournament: clearTournament }, toastService: toast,
    });
    spyOn(component, 'cancelQuickSale');
    const key = 'fees-collector.operational-session';
    const previous = sessionStorage.getItem(key);
    sessionStorage.setItem(key, 'saved-session');
    try {
      await component.suspendCollector();
      expect(stop).not.toHaveBeenCalled();
      expect(component.selected_tournament?.id).toBe(tournament.id);
      modal.result = Promise.resolve(true);
      await component.suspendCollector();
      expect(toast.showWarning).toHaveBeenCalled();
      expect(clearTournament).not.toHaveBeenCalled();
      stop.and.resolveTo(true);
      await component.suspendCollector();
      expect(clearTournament).toHaveBeenCalledTimes(1);
      expect(component.resumeTournament?.id).toBe(tournament.id);
      expect(component.canLeave()).toBeTrue();
      expect(sessionStorage.getItem(key)).toBe('saved-session');
    } finally {
      if (previous === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, previous);
    }
  });
});
