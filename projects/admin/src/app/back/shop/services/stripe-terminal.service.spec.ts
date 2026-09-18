import { StripeTerminalService } from './stripe-terminal.service';

describe('StripeTerminalService', () => {
  it('marks the pending BookEntry as cancelled', async () => {
    const service = new StripeTerminalService();
    const update = jasmine.createSpy('update').and.resolveTo({});
    const client = { models: { BookEntry: { update } } };

    await (service as any)._markBookEntryCancelled(client, 'book-entry-1');

    expect(update).toHaveBeenCalledOnceWith({ id: 'book-entry-1', status: 'cancelled' });
  });

  it('does nothing when the payment has no BookEntry', async () => {
    const service = new StripeTerminalService();
    const update = jasmine.createSpy('update');
    const client = { models: { BookEntry: { update } } };

    await (service as any)._markBookEntryCancelled(client, null);

    expect(update).not.toHaveBeenCalled();
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