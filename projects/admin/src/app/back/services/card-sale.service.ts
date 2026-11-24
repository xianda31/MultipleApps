import { Injectable } from '@angular/core';
import { Member } from '../../common/interfaces/member.interface';
import { BookEntry, Session } from '../../common/interfaces/accounting.interface';
import { CartService } from '../shop/cart/cart.service';
import { PaymentMode } from '../shop/cart/cart.interface';
import { StripeTerminalService } from '../shop/services/stripe-terminal.service';
import { BookService } from './book.service';
import { CardPaymentOrchestratorService } from './card-payment-orchestrator.service';

export interface CardSaleCallbacks {
  onReserved?: (reservationId: string) => void;
  onSuccess: (bookEntryId: string) => void;
  onFailed: (message: string, cleanupComplete: boolean) => void;
  onCancelled: (cleanupComplete: boolean) => void;
  onTimeout: () => void;
  onError: () => void;
}

@Injectable({ providedIn: 'root' })
export class CardSaleService {
  constructor(
    private payment: CardPaymentOrchestratorService,
    private terminal: StripeTerminalService,
    private book: BookService,
  ) {}

  async start(
    cart: CartService, buyer: Member, session: Session, callbacks: CardSaleCallbacks,
    origin: 'shop' | 'pointage' = 'shop',
  ): Promise<void> {
    const amount = cart.getCartAmount();
    if (!Number.isFinite(amount) || Math.round(amount * 100) <= 0) {
      throw new Error('Montant du paiement invalide.');
    }
    let reservationId: string | undefined;
    if (this.payment.isRemoteMode && this.terminal.sharedTpeEnabled) {
      try {
        const reservation = await this.terminal.reserveForSale({
          amountCents: Math.round(amount * 100),
          memberName: `${buyer.lastname} ${buyer.firstname}`,
          buyerMemberId: buyer.id,
          season: session.season,
          date: session.date,
          origin,
        });
        if (!reservation) {
          callbacks.onFailed('TPE déjà utilisé par un autre poste.', true);
          return;
        }
        reservationId = reservation;
        try {
          callbacks.onReserved?.(reservation);
        } catch (error) {
          await this.terminal.cancelPreparedReservation(reservation);
          throw error;
        }
      } catch (error) {
        console.error('[CardSale] TPE reservation could not be confirmed', error);
        callbacks.onError();
        return;
      }
    }
    cart.payment = { amount, payer_id: buyer.id, mode: PaymentMode.CARD, bank: '', cheque_no: '' };
    let entry: BookEntry;
    try {
      entry = await cart.save_sale(session, buyer, 'deferred', false);
    } catch (error) {
      console.error('[CardSale] Sale preparation could not be confirmed', error);
      if (reservationId) {
        try {
          await this.terminal.cancelPreparedReservation(reservationId);
        } catch (releaseError) {
          console.error('[CardSale] TPE release could not be confirmed', releaseError);
        }
      }
      callbacks.onError();
      return;
    }
    let paymentIntentId: string | null = null;
    let paymentAccepted = false;
    try {
      await this.payment.payByCard({
        amountCents: Math.round(amount * 100),
        memberName: `${buyer.lastname} ${buyer.firstname}`,
        memberFirstName: buyer.firstname,
        buyerMemberId: buyer.id,
        buyerEmail: buyer.email || '',
        season: session.season,
        date: session.date,
        bookEntryId: entry.id,
        origin,
        reservationId,
      }, {
        onPaymentIntentCreated: (stripeTag, id) => {
          paymentIntentId = id;
          cart.setStripeTag(stripeTag);
        },
        onSuccess: () => {
          paymentAccepted = true;
          callbacks.onSuccess(entry.id);
        },
        onFailed: callbacks.onFailed,
        onCancelled: callbacks.onCancelled,
        onTimeout: callbacks.onTimeout,
        onError: callbacks.onError,
      });
    } catch (error) {
      if (paymentAccepted) {
        console.error('[CardSale] Payment accepted but completion failed', error);
        callbacks.onError();
        return;
      }
      if (this.payment.isRemoteMode && (paymentIntentId || reservationId)) {
        console.error('[CardSale] Remote payment request could not be confirmed', { bookEntryId: entry.id, paymentIntentId, error });
        callbacks.onError();
        return;
      }
      const cleanupComplete = await this.cleanup(entry, paymentIntentId);
      if (!this.payment.isRemoteMode) this.terminal.resetStatus();
      callbacks.onFailed(error instanceof Error ? error.message : 'Erreur paiement TPE', cleanupComplete);
    }
  }

  private async cleanup(entry: BookEntry, paymentIntentId: string | null): Promise<boolean> {
    try {
      if (paymentIntentId) await this.terminal.cancelPaymentIntent(paymentIntentId);
      await this.book.delete_book_entry(entry);
      return true;
    } catch (error) {
      console.error('[CardSale] Payment cleanup incomplete', { bookEntryId: entry.id, paymentIntentId, error });
      return false;
    }
  }
}
