import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DBhandler } from '../../../common/services/graphQL.service';
import { BookService } from '../../services/book.service';
import { MembersService } from '../../../common/services/members.service';
import { ToastService } from '../../../common/services/toast.service';
import { SystemDataService } from '../../../common/services/system-data.service';
import { StripeService } from '../../../front/services/stripe.service';
import { Member } from '../../../common/interfaces/member.interface';
import { BookEntry, TRANSACTION_ID, FINANCIAL_ACCOUNT } from '../../../common/interfaces/accounting.interface';

interface PayoutLine {
  bookEntry: BookEntry;
  stripeTransaction: any | null;   // StripeTransaction enrichie
  buyerName: string;
  cartSummary: string;
  grossCents: number;              // = bookEntry.amounts[stripe_in] * 100
  feesCents: number;               // depuis StripeTransaction.amountFeesCents ou payout lookup
  get netCents(): number;
  selected: boolean;
}

@Component({
  selector: 'app-stripe-reconciliation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stripe-reconciliation.component.html',
})
export class StripeReconciliationComponent {

  lines: PayoutLine[] = [];
  loadingLines = false;

  // Formulaire payout
  payoutId = '';
  payoutDate = new Date().toISOString().slice(0, 10);
  netBancaire: number | null = null;   // montant net saisi depuis le relevé bancaire
  lookingUp = false;
  processingPayout = false;

  // Computed
  get selectedLines(): PayoutLine[] { return this.lines.filter(l => l.selected); }
  get selectedGrossCents(): number { return this.selectedLines.reduce((s, l) => s + l.grossCents, 0); }
  get selectedFeesCents(): number { return this.selectedLines.reduce((s, l) => s + l.feesCents, 0); }
  get selectedNetCents(): number { return this.selectedGrossCents - this.selectedFeesCents; }
  get netMatch(): boolean {
    return this.netBancaire !== null &&
      Math.round(this.netBancaire * 100) === this.selectedNetCents;
  }
  get allSelected(): boolean { return this.lines.length > 0 && this.lines.every(l => l.selected); }

  private members: Member[] = [];

  constructor(
    private dbHandler: DBhandler,
    private bookService: BookService,
    private membersService: MembersService,
    private toastService: ToastService,
    private systemDataService: SystemDataService,
    private stripeService: StripeService,
  ) {}

  ngOnInit(): void {
    this.bookService.list_book_entries().subscribe(() => {
      this.membersService.listMembers().subscribe((members) => {
        this.members = members;
        this.loadLines();
      });
    });
  }

  async loadLines(): Promise<void> {
    this.loadingLines = true;
    try {
      // BookEntries achat_adhérent_par_carte sans deposit_ref (= non encore réconciliés avec un payout)
      const bookEntries = this.bookService.get_book_entries()
        .filter(e =>
          e.transaction_id === TRANSACTION_ID.achat_adhérent_par_carte &&
          !e.deposit_ref &&
          e.stripeTag   // a un tag Stripe = paiement Stripe confirmé
        );

      // StripeTransactions complétées sans payoutId
      const stripeTransactions = await this.dbHandler.listUnpayoutedStripeTransactions();

      this.lines = bookEntries.map(be => {
        const st = stripeTransactions.find(
          (t: any) => t.bookEntryId === be.id || (be.stripeTag && t.stripeTag === be.stripeTag)
        ) || null;

        const grossCents = Math.round(((be.amounts as any)[FINANCIAL_ACCOUNT.STRIPE_debit] || 0) * 100);

        const member = this.members.find(m =>
          be.operations.some(op => op.member && op.member.includes(m.lastname))
        );
        const buyerName = member
          ? member.lastname + ' ' + member.firstname
          : be.operations.find(op => op.member)?.member || be.tag || '(inconnu)';

        const cartSummary = be.operations
          .filter(op => op.member)
          .map(op => op.label)
          .join(', ') || this.formatAmount(grossCents);

        const line: PayoutLine = {
          bookEntry: be,
          stripeTransaction: st,
          buyerName,
          cartSummary,
          grossCents,
          feesCents: st?.amountFeesCents || 0,
          get netCents() { return this.grossCents - this.feesCents; },
          selected: false,
        };
        return line;
      });
    } catch (error) {
      console.error('Erreur chargement lignes payout:', error);
      this.toastService.showErrorToast('Réconciliation', 'Impossible de charger les paiements');
    } finally {
      this.loadingLines = false;
    }
  }

  toggleAll(checked: boolean): void {
    this.lines.forEach(l => l.selected = checked);
  }

  /**
   * Approche B : auto-sélection depuis Stripe API
   */
  async lookupPayout(): Promise<void> {
    if (!this.payoutId.trim()) {
      this.toastService.showWarning('Lookup payout', 'Identifiant payout requis (po_...)');
      return;
    }
    this.lookingUp = true;
    try {
      const result = await this.stripeService.lookupPayout(this.payoutId.trim());

      // Désélectionner tout d'abord
      this.lines.forEach(l => l.selected = false);

      let matched = 0;
      result.charges.forEach((charge: any) => {
        const line = this.lines.find(l =>
          l.bookEntry.id === charge.bookEntryId ||
          (l.bookEntry.stripeTag && l.bookEntry.stripeTag === charge.stripeTag)
        );
        if (line) {
          line.selected = true;
          line.feesCents = charge.feesCents;
          matched++;
        }
      });

      // Pré-remplir le net bancaire
      this.netBancaire = result.totalNetCents / 100;

      this.toastService.showSuccess('Lookup payout',
        `${matched} paiement(s) identifié(s) sur ${result.charges.length} charge(s) Stripe`);
    } catch (error: any) {
      this.toastService.showErrorToast('Lookup payout', error?.message || 'Erreur Stripe API');
    } finally {
      this.lookingUp = false;
    }
  }

  /**
   * Approche A+B : créer l'écriture virement + marquer les BookEntries
   */
  async createPayout(): Promise<void> {
    if (!this.payoutId.trim()) {
      this.toastService.showWarning('Payout', 'Identifiant payout Stripe requis');
      return;
    }
    if (this.selectedLines.length === 0) {
      this.toastService.showWarning('Payout', 'Aucun paiement sélectionné');
      return;
    }
    if (this.selectedNetCents <= 0) {
      this.toastService.showWarning('Payout', 'Montant net invalide');
      return;
    }

    this.processingPayout = true;
    const reconciledAt = new Date().toISOString();
    const pId = this.payoutId.trim();

    try {
      // 1. Écriture virement_stripe_vers_banque
      await this.bookService.create_book_entry({
        id: '',
        season: this.systemDataService.get_season(new Date(this.payoutDate)),
        date: this.payoutDate,
        transaction_id: TRANSACTION_ID.virement_stripe_vers_banque,
        deposit_ref: pId,
        amounts: {
          [FINANCIAL_ACCOUNT.STRIPE_credit]: this.selectedGrossCents / 100,
          [FINANCIAL_ACCOUNT.BANK_debit]: this.selectedNetCents / 100,
        } as any,
        operations: this.selectedFeesCents > 0 ? [{
          label: 'frais stripe',
          values: { 'BNQ': this.selectedFeesCents / 100 },
        }] : [],
      });

      // 2. Mettre à jour deposit_ref sur chaque BookEntry sélectionné
      await Promise.all(
        this.selectedLines.map(l =>
          this.bookService.update_book_entry({ ...l.bookEntry, deposit_ref: pId })
        )
      );

      // 3. Taguer les StripeTransactions avec le payoutId
      await Promise.all(
        this.selectedLines
          .filter(l => l.stripeTransaction)
          .map(l => this.dbHandler.updateStripeTransactionPayout(l.stripeTransaction.id, pId, reconciledAt))
      );

      this.toastService.showSuccess('Payout',
        `Écriture créée — ${this.selectedLines.length} paiement(s) réconcilié(s) ` +
        `(brut: ${this.formatAmount(this.selectedGrossCents)}, ` +
        `frais: ${this.formatAmount(this.selectedFeesCents)}, ` +
        `net: ${this.formatAmount(this.selectedNetCents)})`);

      // Reset
      this.payoutId = '';
      this.netBancaire = null;
      await this.loadLines();
    } catch (error: any) {
      console.error('Erreur création payout:', error);
      this.toastService.showErrorToast('Payout', 'Erreur lors de la création de l\'écriture');
    } finally {
      this.processingPayout = false;
    }
  }

  formatAmount(cents: number): string {
    return (cents / 100).toFixed(2) + ' €';
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    } catch { return iso; }
  }
}

