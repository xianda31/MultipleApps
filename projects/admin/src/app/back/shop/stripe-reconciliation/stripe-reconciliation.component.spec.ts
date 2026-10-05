import { canReconcilePayoutStatus, paymentCartSummary, refundsForCharge, StripeRefundItem } from './stripe-reconciliation.component';
import { BookEntry, TRANSACTION_ID } from '../../../common/interfaces/accounting.interface';

describe('Stripe payment cart summary', () => {
  it('summarizes a shared product without exposing technical operation labels', () => {
    const bookEntry = {
      id: 'shared-purchase',
      season: '2026/2027',
      date: '2026-09-25',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_carte,
      amounts: {},
      operations: [
        { label: 'vendu par en ligne', member: 'DAVOINE Brigitte', values: { CAR: 30 } },
        { label: 'vendu par en ligne (co-acheteur)', member: 'AUTRE Jean', values: { CAR: 0 } },
      ],
    } satisfies BookEntry;

    expect(paymentCartSummary(bookEntry)).toBe('achat en ligne — CAR · 2 bénéficiaires');
  });

  it('identifies a terminal purchase', () => {
    const bookEntry = {
      id: 'terminal-purchase',
      season: '2026/2027',
      date: '2026-09-25',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_carte,
      amounts: {},
      operations: [
        { label: 'vendu par TPE', member: 'TEST Jean', values: { CAR: 30 } },
      ],
    } satisfies BookEntry;

    expect(paymentCartSummary(bookEntry, 'terminal')).toBe('achat par TPE — CAR');
  });
});

describe('Stripe payout refund matching', () => {
  it('matches a refund by chargeId when its stripeTag is unavailable', () => {
    const refunds: StripeRefundItem[] = [{
      refundId: 're_test',
      chargeId: 'ch_refunded',
      stripeTag: null,
      bookEntryId: null,
      amountCents: -3000,
      feesCents: 0,
      netCents: -3000,
      reason: null,
    }];

    expect(refundsForCharge({
      chargeId: 'ch_refunded',
      stripeTag: 'stripe:charge',
      bookEntryId: null,
      grossCents: 3000,
    }, refunds)).toEqual(refunds);
  });

  it('does not match a refund belonging to another charge', () => {
    const refunds: StripeRefundItem[] = [{
      refundId: 're_other',
      chargeId: 'ch_other',
      stripeTag: 'stripe:other',
      bookEntryId: 'other-entry',
      amountCents: -3000,
      feesCents: 0,
      netCents: -3000,
      reason: null,
    }];

    expect(refundsForCharge({
      chargeId: 'ch_charge',
      stripeTag: 'stripe:charge',
      bookEntryId: 'charge-entry',
      grossCents: 3000,
    }, refunds)).toEqual([]);
  });
});

describe('Stripe payout reconciliation status', () => {
  it('allows only paid payouts to be reconciled', () => {
    expect(canReconcilePayoutStatus('paid')).toBeTrue();
    expect(canReconcilePayoutStatus('pending')).toBeFalse();
    expect(canReconcilePayoutStatus('in_transit')).toBeFalse();
    expect(canReconcilePayoutStatus('canceled')).toBeFalse();
    expect(canReconcilePayoutStatus('failed')).toBeFalse();
  });
});