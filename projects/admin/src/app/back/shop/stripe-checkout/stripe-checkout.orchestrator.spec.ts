import { Member } from '../../../common/interfaces/member.interface';
import { CartItem } from '../cart/cart.interface';
import { StripeCheckoutOrchestrator } from './stripe-checkout.orchestrator';

describe('StripeCheckoutOrchestrator', () => {
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
    const orchestrator = new StripeCheckoutOrchestrator(
      cartService,
      stripeService,
      jasmine.createSpyObj('DBhandler', ['deleteBookEntry']),
      toastService,
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
});
