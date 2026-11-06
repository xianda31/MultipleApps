import { BehaviorSubject, EMPTY, Subject } from 'rxjs';
import { Member } from '../../common/interfaces/member.interface';
import { ShopComponent } from './shop.component';
import { SystemDataService } from '../../common/services/system-data.service';

describe('ShopComponent buyer list', () => {
  function createComponent(onlineMode = false) {
    const members$ = new Subject<Member[]>();
    const membersService = jasmine.createSpyObj('MembersService', [
      'listMembers', 'canPurchase', 'full_name', 'hasLicPaid', 'hasAdhPaid', 'hasPaidMembership',
    ]);
    membersService.listMembers.and.returnValue(members$);
    membersService.canPurchase.and.callFake((member: Member) => member.lifecycleStatus === 'ACTIVE');
    membersService.hasLicPaid.and.returnValue(true);
    membersService.hasAdhPaid.and.returnValue(true);
    membersService.hasPaidMembership.and.returnValue(true);
    const toast = jasmine.createSpyObj('ToastService', ['showError', 'showWarning', 'showInfo']);
    const shopInit = jasmine.createSpyObj('ShopInitializationService', ['initializeShop'], {
      tpeReaderConnected$: EMPTY,
      tpeReaderLabel$: EMPTY,
      tpeScanning$: EMPTY,
    });
    shopInit.initializeShop.and.resolveTo({
      session: { date: '2026-10-29', season: '2026/2027' },
      operations: [],
      canEditPrice: false,
    });
    const products = jasmine.createSpyObj('ShopProductService', ['loadAndOrganizeProducts']);
    products.loadAndOrganizeProducts.and.returnValue(EMPTY);
    const configuration = jasmine.createSpyObj('SystemDataService', ['get_configuration', 'get_season']);
    configuration.get_season.and.callFake((date: Date) => SystemDataService.prototype.get_season(date));
    configuration.get_configuration.and.returnValue(EMPTY);
    const books = jasmine.createSpyObj('BookService', ['is_book_entries_loaded', 'list_book_entries'], {
      loading$: EMPTY,
    });
    books.is_book_entries_loaded.and.returnValue(true);
    books.list_book_entries.and.returnValue(EMPTY);
    const cartService = jasmine.createSpyObj('CartService', [
      'clearCart', 'save_sale', 'setSeller', 'setDebt', 'setAsset', 'getCartItems', 'getCartAmount',
    ], { cart$: EMPTY });
    cartService.getCartItems.and.returnValue([]);
    const loggedMember$ = new BehaviorSubject<Member | null>(null);
    const buyerContext = jasmine.createSpyObj('BuyerContextService', [
      'findBuyerById', 'setupBuyer', 'loadBalance', 'determineLicenseMessage',
    ]);
    buyerContext.findBuyerById.and.callFake((id: string, members: Member[]) => members.find(m => m.id === id));
    buyerContext.setupBuyer.and.callFake(async (buyer: Member | null) => ({
      buyer, debtAmount: 30, assetAmount: 0, message: '',
    }));
    const stripeCheckout = jasmine.createSpyObj('StripeCheckoutOrchestrator', [
      'getCurrentPhase', 'getPendingSessionId', 'initiateCheckout',
    ], { checkoutState$: EMPTY });
    stripeCheckout.getCurrentPhase.and.returnValue('idle');
    stripeCheckout.getPendingSessionId.and.returnValue(null);
    const component = new ShopComponent(
      cartService,
      membersService,
      toast,
      jasmine.createSpyObj('AuthentificationService', [], { logged_member$: loggedMember$ }),
      jasmine.createSpyObj('ActivatedRoute', [], {
        snapshot: {
          data: { onlineMode },
          queryParamMap: { get: () => null },
          paramMap: { get: () => null },
        },
      }),
      jasmine.createSpyObj('Router', ['navigate']),
      stripeCheckout,
      shopInit,
      buyerContext,
      products,
      configuration,
      jasmine.createSpyObj('StripeTerminalService', ['disconnectReader']),
      jasmine.createSpyObj('CardPaymentOrchestratorService', ['cancelRemotePayment']),
      books,
    );
    return { component, members$, membersService, toast, cartService, loggedMember$, buyerContext, stripeCheckout };
  }

  for (const onlineMode of [false, true]) {
    it(`loads local buyers without an FFB dependency (online=${onlineMode})`, async () => {
      const { component, members$, membersService } = createComponent(onlineMode);
      component.ngOnInit();
      await Promise.resolve();
      expect(membersService.listMembers).toHaveBeenCalledTimes(1);
      expect(component.membersLoading).toBeTrue();

      const active = { id: 'active', lifecycleStatus: 'ACTIVE' } as Member;
      const inactive = { id: 'inactive', lifecycleStatus: 'ARCHIVED' } as Member;
      members$.next([active, inactive]);
      expect(component.membersLoading).toBeFalse();
      expect(component.members).toEqual([active]);

      const added = { id: 'new', lifecycleStatus: 'ACTIVE' } as Member;
      members$.next([active, added]);
      expect(component.members).toEqual([active, added]);

      component.ngOnDestroy();
      members$.next([]);
      expect(component.members).toEqual([active, added]);
    });
  }

  it('reports member loading failures instead of leaving a permanent spinner', async () => {
    const { component, members$, toast } = createComponent();
    spyOn(console, 'error');
    component.ngOnInit();
    await Promise.resolve();
    members$.error(new Error('Member list unavailable'));
    expect(component.membersLoading).toBeFalse();
    expect(toast.showError).toHaveBeenCalledWith('Acheteurs', 'Impossible de charger la liste des membres.');
    component.ngOnDestroy();
  });

  it('changes the sale date without resetting the buyer or touching the cart', () => {
    const { component, cartService } = createComponent();
    const buyer = { id: 'buyer', lifecycleStatus: 'ACTIVE' } as Member;
    component.buyerForm.patchValue({ buyer }, { emitEvent: false });
    component.session = { date: '2026-10-29', season: '2026/2027' };
    const reset = spyOn(component.buyerForm, 'reset').and.callThrough();

    component.date_change('2026-10-08');

    expect(component.session).toEqual({ date: '2026-10-08', season: '2026/2027' });
    expect(component.buyer).toBe(buyer);
    expect(reset).not.toHaveBeenCalled();
    expect(cartService.clearCart).not.toHaveBeenCalled();
    expect(cartService.save_sale).not.toHaveBeenCalled();
  });

  it('updates the season at the July boundary', () => {
    const { component } = createComponent();
    component.date_change('2026-06-30');
    expect(component.session.season).toBe('2025/2026');
    component.date_change('2026-07-01');
    expect(component.session.season).toBe('2026/2027');
  });

  for (const date of ['', 'invalid', '2026-02-30']) {
    it(`rejects invalid date "${date}" without altering the sale`, () => {
      const { component, toast, cartService } = createComponent();
      const session = { date: '2026-10-29', season: '2026/2027' };
      component.session = session;
      component.date_change(date);
      expect(component.session).toBe(session);
      expect(toast.showWarning).toHaveBeenCalled();
      expect(cartService.clearCart).not.toHaveBeenCalled();
    });
  }

  it('does not change the date during save or terminal payment', () => {
    const { component } = createComponent();
    const session = { date: '2026-10-29', season: '2026/2027' };
    component.session = session;
    component.isSaving = true;
    component.date_change('2026-10-08');
    expect(component.session).toBe(session);
    component.isSaving = false;
    component.tpePaymentInProgress = true;
    component.date_change('2026-10-08');
    expect(component.session).toBe(session);
  });

  const buyer = {
    id: 'buyer', firstname: 'Jean', lastname: 'TEST', lifecycleStatus: 'ACTIVE',
  } as Member;

  it('loads debt when authentication is already resolved before members arrive', async () => {
    const { component, members$, loggedMember$, buyerContext } = createComponent(true);
    loggedMember$.next(buyer);
    component.ngOnInit();
    await Promise.resolve();
    members$.next([buyer]);
    expect(component.checkoutBlocked).toBeTrue();
    await Promise.resolve();

    expect(buyerContext.setupBuyer).toHaveBeenCalledOnceWith(buyer);
    expect(component.debt_amount).toBe(30);
    expect(component.buyerBalanceReady).toBeTrue();
    expect(component.checkoutBlocked).toBeFalse();
    component.ngOnDestroy();
  });

  it('blocks checkout until a delayed balance is ready', async () => {
    const { component, members$, loggedMember$, buyerContext, stripeCheckout } = createComponent(true);
    let resolveBalance!: (state: { buyer: Member; debtAmount: number; assetAmount: number; message: string }) => void;
    buyerContext.setupBuyer.and.returnValue(new Promise(resolve => { resolveBalance = resolve; }));
    loggedMember$.next(buyer);
    component.ngOnInit();
    await Promise.resolve();
    members$.next([buyer]);
    await component.on_stripe_checkout();
    expect(stripeCheckout.initiateCheckout).not.toHaveBeenCalled();
    expect(buyerContext.loadBalance).not.toHaveBeenCalled();
    expect(component.buyerBalanceLoading).toBeTrue();
    resolveBalance({ buyer, debtAmount: 30, assetAmount: 0, message: '' });
    await Promise.resolve();
    expect(component.checkoutBlocked).toBeFalse();
    component.ngOnDestroy();
  });

  it('keeps checkout blocked with a visible retry message when balances fail', async () => {
    const { component, members$, loggedMember$, buyerContext } = createComponent(true);
    buyerContext.setupBuyer.and.rejectWith(new Error('Accounting unavailable'));
    spyOn(console, 'error');
    loggedMember$.next(buyer);
    component.ngOnInit();
    await Promise.resolve();
    members$.next([buyer]);
    await Promise.resolve();
    expect(component.checkoutBlocked).toBeTrue();
    expect(component.buyerBalanceMessage).toContain('Impossible de charger');
    buyerContext.setupBuyer.and.resolveTo({ buyer, debtAmount: 30, assetAmount: 0, message: '' });
    await component.retryBuyerBalance();
    expect(component.checkoutBlocked).toBeFalse();
    expect(component.buyerBalanceMessage).toBe('');
    component.ngOnDestroy();
  });

  it('updates changed balances without starting Stripe or clearing cart products', async () => {
    const { component, members$, loggedMember$, buyerContext, cartService, stripeCheckout } = createComponent(true);
    loggedMember$.next(buyer);
    component.ngOnInit();
    await Promise.resolve();
    members$.next([buyer]);
    await Promise.resolve();
    buyerContext.loadBalance.and.resolveTo({ buyer, debtAmount: 0, assetAmount: 10, message: '' });
    await component.on_stripe_checkout();
    expect(buyerContext.loadBalance).toHaveBeenCalledOnceWith(buyer, true);
    expect(cartService.setDebt).toHaveBeenCalledWith('TEST Jean', 0);
    expect(cartService.setAsset).toHaveBeenCalledWith('TEST Jean', 10);
    expect(cartService.clearCart).not.toHaveBeenCalled();
    expect(component.buyerBalanceMessage).toContain('confirmez à nouveau');
    expect(stripeCheckout.initiateCheckout).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });

  it('does not start Stripe when the final server balance check fails', async () => {
    const { component, members$, loggedMember$, buyerContext, stripeCheckout } = createComponent(true);
    loggedMember$.next(buyer);
    component.ngOnInit();
    await Promise.resolve();
    members$.next([buyer]);
    await Promise.resolve();
    buyerContext.loadBalance.and.rejectWith(new Error('Network unavailable'));
    spyOn(console, 'error');
    await component.on_stripe_checkout();
    expect(component.buyerBalanceMessage).toContain('Aucun paiement lancé');
    expect(component.buyerBalanceLoading).toBeFalse();
    expect(stripeCheckout.initiateCheckout).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });

  it('requires another click after a changed balance, then submits the updated debt', async () => {
    const { component, members$, loggedMember$, buyerContext, cartService, stripeCheckout } = createComponent(true);
    loggedMember$.next(buyer);
    component.ngOnInit();
    await Promise.resolve();
    members$.next([buyer]);
    await Promise.resolve();
    buyerContext.loadBalance.and.resolveTo({ buyer, debtAmount: 20, assetAmount: 0, message: '' });
    cartService.getCartAmount.and.returnValue(20);
    component.minimumCbAmount = 0;
    stripeCheckout.initiateCheckout.and.rejectWith(new Error('Stop before navigation'));
    spyOn(console, 'error');

    await component.on_stripe_checkout();
    expect(stripeCheckout.initiateCheckout).not.toHaveBeenCalled();
    await component.on_stripe_checkout();
    expect(stripeCheckout.initiateCheckout).toHaveBeenCalledOnceWith(
      [], buyer, 20, 0, component.session, true,
      component.onlineSuccesUrl, component.onlineCancelUrl, undefined,
    );
    expect(component.buyerBalanceMessage).toBe('');
    component.ngOnDestroy();
  });
});
