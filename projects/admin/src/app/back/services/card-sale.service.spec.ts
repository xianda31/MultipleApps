import { Member } from '../../common/interfaces/member.interface';
import { CartService } from '../shop/cart/cart.service';
import { PaymentMode } from '../shop/cart/cart.interface';
import { StripeTerminalService } from '../shop/services/stripe-terminal.service';
import { BookService } from './book.service';
import { CardPaymentOrchestratorService } from './card-payment-orchestrator.service';
import { CardSaleService } from './card-sale.service';

describe('CardSaleService', () => {
  const buyer = { id: 'buyer', firstname: 'Jean', lastname: 'TEST' } as Member;
  const session = { date: '2026-11-23', season: '2026/2027' };

  function setup(shared = false) {
    const cart = jasmine.createSpyObj<CartService>('CartService', ['getCartAmount', 'save_sale', 'setStripeTag']);
    cart.getCartAmount.and.returnValue(30);
    cart.save_sale.and.resolveTo({ id: 'entry' } as never);
    const payment = jasmine.createSpyObj<CardPaymentOrchestratorService>('CardPaymentOrchestratorService',
      ['payByCard'], { isRemoteMode: true });
    const terminal = jasmine.createSpyObj<StripeTerminalService>('StripeTerminalService',
      ['cancelPaymentIntent', 'resetStatus', 'reserveForSale', 'cancelPreparedReservation'],
      { sharedTpeEnabled: shared });
    const book = jasmine.createSpyObj<BookService>('BookService', ['delete_book_entry']);
    const callbacks = {
      onSuccess: jasmine.createSpy('onSuccess'),
      onFailed: jasmine.createSpy('onFailed'),
      onCancelled: jasmine.createSpy('onCancelled'),
      onTimeout: jasmine.createSpy('onTimeout'),
      onError: jasmine.createSpy('onError'),
    };
    return { cart, payment, terminal, book, callbacks, service: new CardSaleService(payment, terminal, book) };
  }

  it('prepares the same deferred sale and forwards its entry after payment', async () => {
    const { cart, payment, callbacks, service } = setup();
    payment.payByCard.and.callFake(async (_params, handlers) => {
      await handlers.onPaymentIntentCreated?.('stripe:1', 'pi_1');
      await handlers.onSuccess({ paymentIntentId: 'pi_1', stripeTag: 'stripe:1' });
    });

    await service.start(cart, buyer, session, callbacks);

    expect(cart.payment.mode).toBe(PaymentMode.CARD);
    expect(cart.save_sale).toHaveBeenCalledOnceWith(session, buyer, 'deferred', false);
    expect(payment.payByCard.calls.mostRecent().args[0].bookEntryId).toBe('entry');
    expect(cart.setStripeTag).toHaveBeenCalledOnceWith('stripe:1');
    expect(callbacks.onSuccess).toHaveBeenCalledOnceWith('entry');
  });

  it('does not delete an entry when a remote request may have been sent', async () => {
    const { cart, payment, terminal, book, callbacks, service } = setup();
    payment.payByCard.and.callFake(async (_params, handlers) => {
      await handlers.onPaymentIntentCreated?.('stripe:1', 'pi_1');
      throw new Error('connection lost');
    });

    await service.start(cart, buyer, session, callbacks);

    expect(callbacks.onError).toHaveBeenCalled();
    expect(terminal.cancelPaymentIntent).not.toHaveBeenCalled();
    expect(book.delete_book_entry).not.toHaveBeenCalled();
  });

  it('does not prepare a sale if another post has reserved the TPE', async () => {
    const { cart, terminal, callbacks, service } = setup(true);
    terminal.reserveForSale.and.resolveTo(null);

    await service.start(cart, buyer, session, callbacks, 'pointage');

    expect(cart.save_sale).not.toHaveBeenCalled();
    expect(callbacks.onFailed).toHaveBeenCalledOnceWith('TPE déjà utilisé par un autre poste.', true);
  });

  it('passes the reservation to the remote payment after preparing the sale', async () => {
    const { cart, payment, terminal, callbacks, service } = setup(true);
    terminal.reserveForSale.and.resolveTo('reservation');
    payment.payByCard.and.resolveTo();

    await service.start(cart, buyer, session, callbacks, 'pointage');

    expect(terminal.reserveForSale).toHaveBeenCalledBefore(cart.save_sale);
    expect(payment.payByCard.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      reservationId: 'reservation', origin: 'pointage', bookEntryId: 'entry',
    }));
  });
});
