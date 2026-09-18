import { refundsForCharge, StripeRefundItem } from './stripe-reconciliation.component';

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