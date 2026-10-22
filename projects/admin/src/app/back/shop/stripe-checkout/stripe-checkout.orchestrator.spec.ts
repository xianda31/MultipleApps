import { Member } from '../../../common/interfaces/member.interface';
import { CartItem } from '../cart/cart.interface';
import { StripeCheckoutOrchestrator } from './stripe-checkout.orchestrator';

describe('StripeCheckoutOrchestrator', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

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
