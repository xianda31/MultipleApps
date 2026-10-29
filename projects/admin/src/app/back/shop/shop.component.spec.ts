import { EMPTY, Subject } from 'rxjs';
import { Member } from '../../common/interfaces/member.interface';
import { ShopComponent } from './shop.component';
import { SystemDataService } from '../../common/services/system-data.service';

describe('ShopComponent buyer list', () => {
  function createComponent(onlineMode = false) {
    const members$ = new Subject<Member[]>();
    const membersService = jasmine.createSpyObj('MembersService', ['listMembers', 'canPurchase']);
    membersService.listMembers.and.returnValue(members$);
    membersService.canPurchase.and.callFake((member: Member) => member.lifecycleStatus === 'ACTIVE');
    const toast = jasmine.createSpyObj('ToastService', ['showError', 'showWarning']);
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
    const cartService = jasmine.createSpyObj('CartService', ['clearCart', 'save_sale'], { cart$: EMPTY });
    const component = new ShopComponent(
      cartService,
      membersService,
      toast,
      jasmine.createSpyObj('AuthentificationService', [], { logged_member$: EMPTY }),
      jasmine.createSpyObj('ActivatedRoute', [], {
        snapshot: {
          data: { onlineMode },
          queryParamMap: { get: () => null },
          paramMap: { get: () => null },
        },
      }),
      jasmine.createSpyObj('Router', ['navigate']),
      jasmine.createSpyObj('StripeCheckoutOrchestrator', [], { checkoutState$: EMPTY }),
      shopInit,
      jasmine.createSpyObj('BuyerContextService', ['findBuyerById']),
      products,
      configuration,
      jasmine.createSpyObj('StripeTerminalService', ['disconnectReader']),
      jasmine.createSpyObj('CardPaymentOrchestratorService', ['cancelRemotePayment']),
      books,
    );
    return { component, members$, membersService, toast, cartService };
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
});
