import { Member } from '../../../common/interfaces/member.interface';
import { CartItem } from '../cart/cart.interface';
import { StripeCheckoutOrchestrator } from './stripe-checkout.orchestrator';
import { CartService } from '../cart/cart.service';

describe('StripeCheckoutOrchestrator', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  for (const buyCard of [false, true]) {
    it(`charges debt with correct purchased items (new card=${buyCard})`, async () => {
      const member = { id: 'buyer', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
      const books = jasmine.createSpyObj('BookService', ['create_book_entry', 'process_book_entry_actions']);
      books.create_book_entry.and.callFake(async (entry: object) => ({ ...entry, id: 'debt-payment' }));
      const products = jasmine.createSpyObj('ProductService', ['getProduct']);
      products.getProduct.and.returnValue({ fulfillmentAction: 'CREATE_PLAYBOOK', productCode: 'CAR12' });
      const cards = jasmine.createSpyObj('GameCardService', ['createCard', 'refreshCards']);
      const cart = new CartService(books, products, cards);
      cart.setBuyer('TEST Jean');
      cart.setDebt('TEST Jean', 30);
      if (buyCard) cart.addToCart({
        product_id: 'card-product', product_account: 'CAR', payee: member,
        payee_name: 'TEST Jean', paied: 30,
      });
      const stripe = jasmine.createSpyObj('StripeService', ['createCheckoutSession', 'associateBookEntry']);
      stripe.createCheckoutSession.and.resolveTo({
        data: { sessionId: 'cs_test_debt123456789', sessionUrl: 'https://checkout.stripe.test/session' },
      });
      stripe.associateBookEntry.and.resolveTo();
      const members = jasmine.createSpyObj('MembersService', ['canPurchase']);
      members.canPurchase.and.returnValue(true);
      const orchestrator = new StripeCheckoutOrchestrator(
        cart, stripe, jasmine.createSpyObj('DBhandler', ['deleteBookEntry']),
        jasmine.createSpyObj('ToastService', ['showError']), members,
      );
      await orchestrator.initiateCheckout(
        cart.getCartItems(), member, 30, 0, { season: '2026/2027', date: '2026-11-06' },
        true, 'https://example.test/success', 'https://example.test/cancel',
      );
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(jasmine.objectContaining({
        productIds: buyCard ? ['card-product'] : [],
        quantities: buyCard ? [1] : [],
        debtAmountCents: 3000,
      }));
      const entry = books.create_book_entry.calls.mostRecent().args[0];
      expect(entry.amounts.stripe_in).toBe(buyCard ? 60 : 30);
      expect(entry.purchasedItems).toEqual(buyCard
        ? [{ productId: 'card-product', beneficiaryMemberIds: ['buyer'], quantity: 1 }] : []);
      expect(entry.operations[0].values.creance_out).toBe(30);
      expect(entry.operations[0].values.CAR).toBe(buyCard ? 30 : undefined);
      expect(cards.createCard).not.toHaveBeenCalled();
      expect(books.process_book_entry_actions).not.toHaveBeenCalled();
    });
  }

  it('associates the pending BookEntry before returning the Stripe URL', async () => {
    const member = {
      id: 'member-1',
      firstname: 'Jean',
      lastname: 'TEST',
      email: 'jean@example.org',
    } as Member;
    const cartItems = [{
      product_id: 'card-product',
      product_account: 'CAR',
      payee: member,
      payee_name: 'TEST Jean',
      paied: 30,
    }] as CartItem[];
    const cartService = jasmine.createSpyObj('CartService', ['setStripeTag', 'getCartAmount', 'save_sale']);
    cartService.getCartAmount.and.returnValue(30);
    cartService.save_sale.and.resolveTo({ id: 'book-entry-1' });
    const stripeService = jasmine.createSpyObj('StripeService', [
      'createCheckoutSession',
      'associateBookEntry',
      'cancelCheckout',
    ]);
    stripeService.createCheckoutSession.and.resolveTo({
      data: {
        sessionId: 'cs_test_123456789012',
        sessionUrl: 'https://checkout.stripe.test/session',
      },
    });
    stripeService.associateBookEntry.and.resolveTo();
    const toastService = jasmine.createSpyObj('ToastService', ['showError']);
    const membersService = jasmine.createSpyObj('MembersService', ['canPurchase']);
    membersService.canPurchase.and.returnValue(true);
    const orchestrator = new StripeCheckoutOrchestrator(
      cartService,
      stripeService,
      jasmine.createSpyObj('DBhandler', ['deleteBookEntry']),
      toastService,
      membersService,
    );

    const result = await orchestrator.initiateCheckout(
      cartItems,
      member,
      0,
      0,
      { season: '2026/2027', date: '2026-09-16' },
      true,
      'https://example.org/success',
      'https://example.org/cancel',
    );

    expect(cartService.save_sale).toHaveBeenCalledWith(
      { season: '2026/2027', date: '2026-09-16' },
      undefined,
      'deferred',
    );
    expect(stripeService.associateBookEntry).toHaveBeenCalledOnceWith(
      'cs_test_123456789012',
      'book-entry-1',
    );
    expect(result.sessionUrl).toBe('https://checkout.stripe.test/session');
  });

  it('reuses an in-flight checkout when two submissions happen concurrently', async () => {
    const member = {
      id: 'member-1',
      firstname: 'Jean',
      lastname: 'TEST',
      email: 'jean@example.org',
    } as Member;
    const cartItems = [{
      product_id: 'card-product',
      product_account: 'CAR',
      payee: member,
      payee_name: 'TEST Jean',
      paied: 30,
    }] as CartItem[];
    const cartService = jasmine.createSpyObj('CartService', ['setStripeTag', 'getCartAmount', 'save_sale']);
    cartService.getCartAmount.and.returnValue(30);
    cartService.save_sale.and.resolveTo({ id: 'book-entry-1' });
    const stripeService = jasmine.createSpyObj('StripeService', [
      'createCheckoutSession',
      'associateBookEntry',
      'cancelCheckout',
    ]);
    let resolveSession!: (value: any) => void;
    stripeService.createCheckoutSession.and.returnValue(new Promise(resolve => {
      resolveSession = resolve;
    }));
    stripeService.associateBookEntry.and.resolveTo();
    const membersService = jasmine.createSpyObj('MembersService', ['canPurchase']);
    membersService.canPurchase.and.returnValue(true);
    const orchestrator = new StripeCheckoutOrchestrator(
      cartService,
      stripeService,
      jasmine.createSpyObj('DBhandler', ['deleteBookEntry']),
      jasmine.createSpyObj('ToastService', ['showError']),
      membersService,
    );
    const args = [
      cartItems,
      member,
      0,
      0,
      { season: '2026/2027', date: '2026-09-16' },
      true,
      'https://example.org/success',
      'https://example.org/cancel',
    ] as const;

    const first = orchestrator.initiateCheckout(...args);
    const second = orchestrator.initiateCheckout(...args);
    resolveSession({
      data: {
        sessionId: 'cs_test_123456789012',
        sessionUrl: 'https://checkout.stripe.test/session',
      },
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(stripeService.createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(cartService.save_sale).toHaveBeenCalledTimes(1);
    expect(stripeService.associateBookEntry).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual(secondResult);
  });
});
