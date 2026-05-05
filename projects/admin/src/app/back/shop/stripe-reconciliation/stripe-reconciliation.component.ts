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

interface StripePayout {
  id: string;
  amountCents: number;
  status: string;
  arrivalDate: string;
  description: string | null;
  automatic: boolean;
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

  // Rapprochements déjà effectués (annulation possible)
  reconciledPayouts: { payoutId: string; bookEntries: BookEntry[] }[] = [];
  undoingPayoutId: string | null = null;

  // Paiements orphelins : deposit_ref set mais aucune écriture virement correspondante
  orphanedPayments: BookEntry[] = [];
  fixingOrphans = false;

  // Liste des payouts Stripe
  availablePayouts: StripePayout[] = [];
  loadingPayouts = false;
  payoutsError: string | null = null;
  private reconciledPayoutIds = new Set<string>();

  get filteredPayouts(): StripePayout[] {
    return this.availablePayouts.filter(p => !this.reconciledPayoutIds.has(p.id));
  }

  // Formulaire payout
  payoutId = '';
  payoutDate = new Date().toISOString().slice(0, 10);
  netBancaire: number | null = null;   // montant net viré en banque
  lookingUp = false;
  processingPayout = false;
  isManualPayout = false;

  // Données de cohérence issues du lookup automatique
  expectedGrossCents = 0;    // brut total attendu (depuis Stripe, payout auto uniquement)
  expectedChargeCount = 0;   // nombre de charges attendues

  // Computed
  get selectedLines(): PayoutLine[] { return this.lines.filter(l => l.selected); }
  get selectedGrossCents(): number { return this.selectedLines.reduce((s, l) => s + l.grossCents, 0); }
  get selectedFeesCents(): number { return this.selectedLines.reduce((s, l) => s + l.feesCents, 0); }
  get selectedNetCents(): number { return this.selectedGrossCents - this.selectedFeesCents; }
  get allSelected(): boolean { return this.lines.length > 0 && this.lines.every(l => l.selected); }

  // Cohérence de la sélection
  get impliedFeesCents(): number {
    return this.netBancaire !== null ? this.selectedGrossCents - Math.round(this.netBancaire * 100) : 0;
  }
  get selectionCoherent(): boolean {
    if (this.selectedLines.length === 0 || !this.netBancaire) return false;
    if (!this.isManualPayout && this.expectedGrossCents > 0) {
      // Auto: le brut sélectionné doit correspondre exactement
      return this.selectedGrossCents === this.expectedGrossCents;
    }
    // Manuel: frais implicites < 10% du brut
    return this.impliedFeesCents >= 0 && this.impliedFeesCents / this.selectedGrossCents < 0.10;
  }
  get coherenceWarning(): string | null {
    if (this.selectedLines.length === 0 || !this.netBancaire) return null;
    if (!this.isManualPayout && this.expectedGrossCents > 0) {
      if (this.selectedGrossCents !== this.expectedGrossCents) {
        const diff = this.selectedGrossCents - this.expectedGrossCents;
        return `Brut sélectionné (${this.formatAmount(this.selectedGrossCents)}) ≠ brut Stripe attendu (${this.formatAmount(this.expectedGrossCents)}) — écart : ${diff > 0 ? '+' : ''}${this.formatAmount(diff)}`;
      }
    } else if (this.isManualPayout && this.impliedFeesCents > 0) {
      const rate = this.impliedFeesCents / this.selectedGrossCents;
      if (rate >= 0.10) {
        return `Frais implicites inhabituellement élevés (${(rate * 100).toFixed(1)}% du brut) — vérifiez la sélection.`;
      }
    }
    return null;
  }

  private members: Member[] = [];
  private CB_fees_account: string = '';

  constructor(
    private dbHandler: DBhandler,
    private bookService: BookService,
    private membersService: MembersService,
    private toastService: ToastService,
    private systemDataService: SystemDataService,
    private stripeService: StripeService,
  ) {}

  ngOnInit(): void {
    this.loadStripePayouts();
    this.systemDataService.get_configuration().subscribe(conf => {
      this.CB_fees_account = conf.CB_fees_account || '';
      if (!this.CB_fees_account) {
        this.toastService.showError('Configuration', 'Compte frais CB non configuré — configurez-le dans les paramètres système');
      }
    });
    this.bookService.list_book_entries().subscribe(() => {
      this.membersService.listMembers().subscribe((members) => {
        this.members = members;
        this.loadLines();
      });
    });
  }

  async loadStripePayouts(): Promise<void> {
    this.loadingPayouts = true;
    this.payoutsError = null;
    try {
      this.availablePayouts = await this.stripeService.listPayouts();
    } catch (error: any) {
      this.payoutsError = error?.message || 'Impossible de charger les virements Stripe';
    } finally {
      this.loadingPayouts = false;
    }
  }

  async selectPayout(payout: StripePayout): Promise<void> {
    this.payoutId = payout.id;
    this.payoutDate = payout.arrivalDate;
    this.netBancaire = payout.amountCents / 100;
    this.expectedGrossCents = 0;
    this.expectedChargeCount = 0;
    await this.lookupPayout();
  }

  payoutStatusClass(status: string): string {
    if (status === 'paid') return 'text-success';
    if (status === 'pending' || status === 'in_transit') return 'text-warning';
    return 'text-danger';
  }

  payoutStatusLabel(status: string): string {
    if (status === 'paid') return 'Viré';
    if (status === 'in_transit') return 'En transit';
    if (status === 'pending') return 'En attente';
    if (status === 'canceled') return 'Annulé';
    return status;
  }

  async loadLines(): Promise<void> {
    this.loadingLines = true;
    try {
      const allBookEntries = this.bookService.get_book_entries();

      // BookEntries virement_stripe_vers_banque avec deposit_ref po_xxx = payouts déjà réconciliés
      const payoutBookEntries = allBookEntries.filter(e =>
        e.transaction_id === TRANSACTION_ID.virement_stripe_vers_banque &&
        e.deposit_ref?.startsWith('po_')
      );
      this.reconciledPayoutIds = new Set(payoutBookEntries.map(e => e.deposit_ref!));

      // Regrouper les bookEntries de virement par payoutId (pour permettre l'annulation)
      const payoutMap = new Map<string, BookEntry[]>();
      for (const e of payoutBookEntries) {
        const pId = e.deposit_ref!;
        if (!payoutMap.has(pId)) payoutMap.set(pId, []);
        payoutMap.get(pId)!.push(e);
      }
      this.reconciledPayouts = [...payoutMap.entries()]
        .map(([payoutId, bookEntries]) => ({ payoutId, bookEntries }))
        .sort((a, b) => b.bookEntries[0].date.localeCompare(a.bookEntries[0].date));

      // Paiements orphelins : deposit_ref set mais aucune écriture virement correspondante
      this.orphanedPayments = allBookEntries.filter(e =>
        e.transaction_id === TRANSACTION_ID.achat_adhérent_par_carte &&
        e.deposit_ref?.startsWith('po_') &&
        !this.reconciledPayoutIds.has(e.deposit_ref)
      );

      // BookEntries achat_adhérent_par_carte ou report_psp sans deposit_ref (= non encore réconciliés avec un payout)
      const bookEntries = allBookEntries
        .filter(e =>
          (e.transaction_id === TRANSACTION_ID.achat_adhérent_par_carte ||
           e.transaction_id === TRANSACTION_ID.report_psp) &&
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
      this.toastService.showError('Réconciliation', 'Impossible de charger les paiements');
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
    this.isManualPayout = false;
    try {
      const result = await this.stripeService.lookupPayout(this.payoutId.trim());

      if (result.isManual) {
        this.isManualPayout = true;
        this.expectedGrossCents = 0;
        this.expectedChargeCount = 0;
        this.toastService.showWarning('Virement manuel',
          'Ce virement a été créé manuellement — sélectionnez les paiements manuellement dans la liste.');
        return;
      }

      // Mémoriser les totaux Stripe pour contrôle de cohérence
      this.expectedGrossCents = result.totalGrossCents;
      this.expectedChargeCount = result.charges.length;

      // Désélectionner tout d'abord
      this.lines.forEach(l => l.selected = false);

      const allBookEntries = this.bookService.get_book_entries();
      const pId = this.payoutId.trim();
      let matched = 0;
      const wrongPayoutTags: string[] = [];

      result.charges.forEach((charge: any) => {
        const line = this.lines.find(l =>
          l.bookEntry.id === charge.bookEntryId ||
          (l.bookEntry.stripeTag && l.bookEntry.stripeTag === charge.stripeTag)
        );
        if (line) {
          line.selected = true;
          line.feesCents = charge.feesCents;
          matched++;
        } else if (charge.stripeTag) {
          // Détecter si cette charge est déjà réconciliée avec un AUTRE payout (deposit_ref incorrect)
          const alreadyReconciled = allBookEntries.find(e =>
            e.stripeTag === charge.stripeTag &&
            e.deposit_ref &&
            e.deposit_ref !== pId
          );
          if (alreadyReconciled) {
            wrongPayoutTags.push(`${charge.stripeTag} → ${alreadyReconciled.deposit_ref}`);
          }
        }
      });

      // Pré-remplir le net bancaire
      this.netBancaire = result.totalNetCents / 100;

      this.toastService.showSuccess('Lookup payout',
        `${matched} paiement(s) identifié(s) sur ${result.charges.length} charge(s) Stripe`);

      if (wrongPayoutTags.length > 0) {
        this.toastService.showWarning('Lookup payout',
          `${wrongPayoutTags.length} charge(s) déjà réconciliée(s) avec un autre payout :\n${wrongPayoutTags.join('\n')}\nCorrigez le deposit_ref (remettez-le à null) pour re-réconcilier.`);
      }
    } catch (error: any) {
      this.toastService.showError('Lookup payout', error?.message || 'Erreur Stripe API');
    } finally {
      this.lookingUp = false;
    }
  }

  /**
   * Réinitialise deposit_ref sur les paiements orphelins
   * (deposit_ref set mais aucune écriture virement correspondante en BD)
   */
  async fixOrphans(): Promise<void> {
    if (this.orphanedPayments.length === 0) return;
    this.fixingOrphans = true;
    try {
      await Promise.all(
        this.orphanedPayments.map(e => this.bookService.update_book_entry({ ...e, deposit_ref: null as any }))
      );
      this.toastService.showSuccess('Réparation',
        `${this.orphanedPayments.length} paiement(s) orphelin(s) réintégré(s) dans la liste`
      );
      await this.loadLines();
    } catch (error: any) {
      console.error('Erreur fixOrphans:', error);
      this.toastService.showError('Réparation', 'Erreur lors de la réinitialisation');
    } finally {
      this.fixingOrphans = false;
    }
  }

  /**
   * Annule un rapprochement existant :
   * - Supprime toutes les écritures virement_stripe_vers_banque liées au payoutId
   * - Réinitialise payoutId + reconciledAt sur les StripeTransactions correspondantes
   * - Les BookEntries paiement (deposit_ref) sont réinitialisés si présents
   */
  async undoPayout(pId: string): Promise<void> {
    this.undoingPayoutId = pId;
    try {
      const allBookEntries = this.bookService.get_book_entries();

      // 1. Supprimer toutes les écritures virement liées à ce payoutId (peut être > 1 si doublon)
      const payoutEntries = allBookEntries.filter(e =>
        e.transaction_id === TRANSACTION_ID.virement_stripe_vers_banque &&
        e.deposit_ref === pId
      );
      await Promise.all(payoutEntries.map(e => this.bookService.delete_book_entry(e)));

      // 2. Réinitialiser deposit_ref sur les BookEntries paiement marqués avec ce payoutId
      const paymentEntries = allBookEntries.filter(e =>
        e.transaction_id === TRANSACTION_ID.achat_adhérent_par_carte &&
        e.deposit_ref === pId
      );
      await Promise.all(
        paymentEntries.map(e => this.bookService.update_book_entry({ ...e, deposit_ref: null as any }))
      );

      // 3. Réinitialiser payoutId sur les StripeTransactions
      const transactions = await this.dbHandler.listStripeTransactionsByPayoutId(pId);
      await Promise.all(transactions.map((t: any) => this.dbHandler.resetStripeTransactionPayout(t.id)));

      const count = payoutEntries.length;
      this.toastService.showSuccess('Annulation',
        `Rapprochement ${pId} annulé — ${count} écriture(s) supprimée(s), ${transactions.length} transaction(s) réinitialisée(s)`
      );
      await this.loadLines();
    } catch (error: any) {
      console.error('Erreur annulation payout:', error);
      this.toastService.showError('Annulation', 'Erreur lors de l\'annulation du rapprochement');
    } finally {
      this.undoingPayoutId = null;
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
    if (!this.netBancaire || this.netBancaire <= 0) {
      this.toastService.showWarning('Payout', 'Montant net invalide');
      return;
    }
    this.processingPayout = true;
    const reconciledAt = new Date().toISOString();
    const pId = this.payoutId.trim();

    // Capturer les valeurs avant les opérations async (les getters seraient recalculés à 0 après loadLines)
    // IMPORTANT: selectedLines est un getter sur this.lines — create_book_entry émet _book_entries$ ce qui
    // déclenche la subscription ngOnInit → loadLines() → this.lines est reconstruit avec selected=false
    const snapshotLines = [...this.selectedLines];
    const snapshotCount = snapshotLines.length;
    const snapshotGross = this.selectedGrossCents;
    const netCents = Math.round(this.netBancaire * 100);
    const snapshotFees = snapshotGross - netCents;
    const snapshotNet = netCents;

    // bank_report au format YY-MM (même convention que le rapprochement bancaire)
    const pd = new Date(this.payoutDate);
    const bank_report = pd.getFullYear().toString().slice(-2) + '-' + (1 + pd.getMonth()).toString().padStart(2, '0');

    try {
      // 1. Écriture virement_stripe_vers_banque — bank_report positionné d'emblée
      //    car la date du virement Stripe = date du relevé bancaire → pas besoin de repasser
      //    par la page rapprochement bancaire pour pointer cette ligne.
      await this.bookService.create_book_entry({
        id: '',
        season: this.systemDataService.get_season(new Date(this.payoutDate)),
        date: this.payoutDate,
        transaction_id: TRANSACTION_ID.virement_stripe_vers_banque,
        deposit_ref: pId,
        bank_report: bank_report,
        amounts: {
          [FINANCIAL_ACCOUNT.STRIPE_credit]: snapshotGross / 100,
          [FINANCIAL_ACCOUNT.BANK_debit]: snapshotNet / 100,
        } as any,
        operations: snapshotFees > 0 ? [{
          label: 'virement organisme CB',
          values: { [this.CB_fees_account]: snapshotFees / 100 },
        }] : [],
      });

      // 2. Mettre à jour deposit_ref sur chaque BookEntry sélectionné
      await Promise.all(
        snapshotLines.map(l =>
          this.bookService.update_book_entry({ ...l.bookEntry, deposit_ref: pId })
        )
      );

      // 3. Taguer les StripeTransactions avec le payoutId
      await Promise.all(
        snapshotLines
          .filter(l => l.stripeTransaction)
          .map(l => this.dbHandler.updateStripeTransactionPayout(l.stripeTransaction.id, pId, reconciledAt))
      );

      this.toastService.showSuccess('Payout',
        `Écriture créée — ${snapshotCount} paiement(s) réconcilié(s) ` +
        `(brut: ${this.formatAmount(snapshotGross)}, ` +
        `frais: ${this.formatAmount(snapshotFees)}, ` +
        `net: ${this.formatAmount(snapshotNet)})`);

      // Reset
      this.payoutId = '';
      this.netBancaire = null;
      this.payoutDate = new Date().toISOString().slice(0, 10);
      this.expectedGrossCents = 0;
      this.expectedChargeCount = 0;
      this.isManualPayout = false;
      await this.loadLines();
    } catch (error: any) {
      console.error('Erreur création payout:', error);
      this.toastService.showError('Payout', 'Erreur lors de la création de l\'écriture');
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

