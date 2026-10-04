import { BookEntry, FINANCIAL_ACCOUNT, TRANSACTION_ID } from '../../common/interfaces/accounting.interface';
import { TransactionService } from './transaction.service';

describe('TransactionService contextual labels', () => {
  const service = new TransactionService(jasmine.createSpyObj('ToastService', ['showError']));

  function transfer(amounts: BookEntry['amounts']): BookEntry {
    return {
      id: 'transfer',
      season: '2026/2027',
      date: '2026-10-04',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_virement,
      amounts,
      operations: [],
    };
  }

  function card(stripeSessionId?: string, stripeTag?: string): BookEntry {
    return {
      id: 'card',
      season: '2026/2027',
      date: '2026-10-04',
      transaction_id: TRANSACTION_ID.achat_adhérent_par_carte,
      amounts: { [FINANCIAL_ACCOUNT.STRIPE_debit]: 30 },
      operations: [],
      stripeSessionId,
      stripeTag,
    };
  }

  it('uses lowercase for a technical announced transfer', () => {
    expect(service.get_entry_label(transfer({}))).toBe('virement annoncé');
  });

  it('uses uppercase for a received transfer that is bank-reconcilable', () => {
    expect(service.get_entry_label(transfer({ [FINANCIAL_ACCOUNT.BANK_debit]: 50 }))).toBe('VIREMENT');
  });

  it('identifies an online card payment from its Checkout session', () => {
    expect(service.get_entry_label(card('cs_online'))).toBe('paiement en ligne');
  });

  it('identifies a terminal card payment from its PaymentIntent', () => {
    expect(service.get_entry_label(card('pi_terminal'))).toBe('paiement par carte');
  });

  it('identifies a historical online payment from its short Stripe tag', () => {
    expect(service.get_entry_label(card(undefined, 'stripe:123456789abc'))).toBe('paiement en ligne');
  });

  it('identifies a historical terminal payment from its short Stripe tag', () => {
    expect(service.get_entry_label(card(undefined, 'stripe:12AB34CD'))).toBe('paiement par carte');
  });

  it('preserves the channel on a card payment refund', () => {
    const refund = {
      ...card(undefined, 'stripe:12AB34CD'),
      transaction_id: TRANSACTION_ID.annulation_paiement_carte_adhérent,
    };

    expect(service.get_entry_label(refund)).toBe('remboursement paiement par carte');
  });

  it('identifies an online payment refund', () => {
    const refund = {
      ...card(undefined, 'stripe:123456789abc'),
      transaction_id: TRANSACTION_ID.annulation_paiement_carte_adhérent,
    };

    expect(service.get_entry_label(refund)).toBe('remboursement paiement en ligne');
  });

  it('uses a neutral card label for legacy entries', () => {
    expect(service.get_entry_label(card())).toBe('paiement par carte');
  });
});