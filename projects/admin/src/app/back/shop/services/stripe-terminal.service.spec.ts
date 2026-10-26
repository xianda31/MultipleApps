import { StripeTerminalService } from './stripe-terminal.service';

describe('StripeTerminalService', () => {
  it('cancels the PaymentIntent and deletes the pending BookEntry', async () => {
    const service = new StripeTerminalService();
    spyOn(service, 'cancelPaymentIntent').and.resolveTo();
    const deleteBookEntry = jasmine.createSpy('delete').and.resolveTo({ errors: undefined });
    const client = { models: { BookEntry: { delete: deleteBookEntry } } };

    const result = await (service as any)._cleanupFailedPayment(
      client,
      'payment-intent-1',
      'book-entry-1',
    );

    expect(service.cancelPaymentIntent).toHaveBeenCalledOnceWith('payment-intent-1');
    expect(deleteBookEntry).toHaveBeenCalledOnceWith({ id: 'book-entry-1' });
    expect(result).toBeTrue();
  });

  it('does not delete the BookEntry when PaymentIntent cancellation fails', async () => {
    const service = new StripeTerminalService();
    spyOn(service, 'cancelPaymentIntent').and.rejectWith(new Error('Stripe unavailable'));
    const deleteBookEntry = jasmine.createSpy('delete');
    const client = { models: { BookEntry: { delete: deleteBookEntry } } };
    spyOn(console, 'error');

    const result = await (service as any)._cleanupFailedPayment(
      client,
      'payment-intent-1',
      'book-entry-1',
    );

    expect(deleteBookEntry).not.toHaveBeenCalled();
    expect(result).toBeFalse();
  });

  it('clears every identifier when a remote payment finishes', () => {
    const service = new StripeTerminalService();
    (service as any)._pendingPaymentRequestId = 'request-1';
    (service as any)._pendingPaymentIntentId = 'intent-1';
    (service as any)._pendingBookEntryId = 'book-entry-1';

    (service as any)._cleanupPaymentSub();

    expect((service as any)._pendingPaymentRequestId).toBeNull();
    expect((service as any)._pendingPaymentIntentId).toBeNull();
    expect((service as any)._pendingBookEntryId).toBeNull();
  });
});