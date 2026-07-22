import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StripeService } from '../../../front/services/stripe.service';
import { BookService } from '../../services/book.service';
import { ToastService } from '../../../common/services/toast.service';
import { SystemDataService } from '../../../common/services/system-data.service';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

interface StripeCharge {
  chargeId: string;
  stripeTag?: string;
  customerName?: string | null;
  amountCents: number;
  feeCents: number;
  netCents: number;
  createdAt: number;
  refundedAmountCents?: number;
  chargeStatus: string;
  payoutStatus: string;
  refundStatus: 'not_refunded' | 'partial' | 'full';
  isProcessing: boolean;
  hasBookEntry: boolean;
  errorMessage?: string;
}

@Component({
  selector: 'app-stripe-refunds',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbTooltipModule],
  templateUrl: './stripe-refunds.component.html',
  styleUrl: './stripe-refunds.component.scss'
})
export class StripeRefundsComponent implements OnInit {
  
  charges: StripeCharge[] = [];
  selectedCharge: StripeCharge | null = null;
  isLoading = false;
  refundAmount: number | null = null;
  refundReason: string = '';
  season: string = '';
  showDisabled = true; // Afficher les transactions orphelines (sans écriture comptable)

  get visibleCharges(): StripeCharge[] {
    return this.showDisabled ? this.charges : this.charges.filter(c => c.hasBookEntry);
  }

  get hasOrphanCharges(): boolean {
    return this.charges.some(c => !c.hasBookEntry);
  }

  constructor(
    private stripeService: StripeService,
    private bookService: BookService,
    private toastService: ToastService,
    private systemDataService: SystemDataService
  ) {
    this.season = this.systemDataService.get_local_season();
  }

  ngOnInit() {
    this.loadCharges();
  }

  loadCharges() {
    this.isLoading = true;
    // Appeler avec filtres par défaut:
    // - charge_status: 'succeeded' (paiements réussis)
    // - payout_status: 'pending' (en attente de versement au compte)
    // - refund_status: 'not_refunded,partial' (pas remboursées ou partiellement)
    this.stripeService.getRefundableCharges({
      charge_status: 'succeeded',
      payout_status: 'pending',
      refund_status: 'not_refunded,partial'
    })
      .then((charges: StripeCharge[]) => {
        this.charges = charges
          .map(c => ({
            ...c,
            isProcessing: false,
            errorMessage: undefined,
            hasBookEntry: !!c.stripeTag && !!this.bookService.find_book_entry_by_stripe_tag(c.stripeTag)
          }))
          .sort((a, b) => b.createdAt - a.createdAt);
        this.isLoading = false;
      })
      .catch((err: any) => {
        this.toastService.showError('Erreur', 'Impossible de charger les transactions Stripe');
        console.error(err);
        this.isLoading = false;
      });
  }

  selectCharge(charge: StripeCharge) {
    this.selectedCharge = { ...charge, isProcessing: false };
    // Montant remboursable = montant brut - déjà remboursé (remboursement complet uniquement)
    this.refundAmount = (charge.amountCents - (charge.refundedAmountCents || 0)) / 100;
    this.refundReason = '';
  }

  getRefundStatusLabel(status: StripeCharge['refundStatus']): string {
    const labels: Record<StripeCharge['refundStatus'], string> = {
      not_refunded: 'Non remboursé',
      partial: 'Partiellement remboursé',
      full: 'Remboursé'
    };
    return labels[status];
  }

  getRefundStatusBadgeClass(status: StripeCharge['refundStatus']): string {
    const classes: Record<StripeCharge['refundStatus'], string> = {
      not_refunded: 'bg-danger',
      partial: 'bg-warning',
      full: 'bg-success'
    };
    return classes[status];
  }

  async processRefund() {
    if (!this.selectedCharge || this.refundAmount === null) {
      this.toastService.showWarning('Attention', 'Sélectionnez une charge et montant');
      return;
    }

    // Validation montant
    const maxRefund = (this.selectedCharge.amountCents - (this.selectedCharge.refundedAmountCents || 0)) / 100;
    if (this.refundAmount <= 0 || this.refundAmount > maxRefund) {
      this.toastService.showError('Erreur', `Le montant doit être entre 0.01€ et ${maxRefund.toFixed(2)}€`);
      return;
    }

    this.selectedCharge.isProcessing = true;
    this.selectedCharge.errorMessage = undefined;

    try {
      // 1. Vérifier l'existence de la BookEntry source AVANT tout appel Stripe
      const sourceEntry = this.bookService.find_book_entry_by_stripe_tag(this.selectedCharge.stripeTag || '');
      if (!sourceEntry) {
        throw new Error(`Aucune écriture comptable trouvée pour ${this.selectedCharge.stripeTag}. Le remboursement est bloqué pour éviter une incohérence comptable.`);
      }

      // 2. Demander le remboursement à Stripe
      const refundResponse = await this.stripeService.createRefund({
        chargeId: this.selectedCharge.chargeId,
        amountCents: Math.round(this.refundAmount * 100),
        reason: this.refundReason || 'Remboursement client',
        stripeTag: this.selectedCharge.stripeTag
      });

      if (!refundResponse || !refundResponse.refundId) {
        throw new Error('Refund creation failed');
      }

      // 3. Créer la BookEntry de remboursement symétrique
      await this.bookService.create_refund_book_entry(
        sourceEntry,
        Math.round(this.refundAmount * 100)
      );

      // 4. Marquer la charge comme remboursée dans la liste locale
      this.selectedCharge.refundStatus = 'full';
      this.selectedCharge.refundedAmountCents = Math.round(this.refundAmount * 100);
      
      this.toastService.showSuccess('Succès', `Remboursement de ${this.refundAmount}€ effectué et enregistré`);
      
      // 5. Réinitialiser la sélection
      this.selectedCharge.isProcessing = false;
      this.selectedCharge = null;
      this.refundAmount = null;
      this.refundReason = '';

    } catch (error: any) {
      if (this.selectedCharge) {
        this.selectedCharge.isProcessing = false;
        this.selectedCharge.errorMessage = error?.message || 'Erreur lors du remboursement';
      }
      this.toastService.showError('Erreur', error?.message || 'Erreur lors du remboursement');
      console.error('Refund error:', error);
    }
  }

  cancelSelection() {
    this.selectedCharge = null;
    this.refundAmount = null;
    this.refundReason = '';
  }

  formatDate(timestamp: number): string {
    // timestamp est déjà en millisecondes depuis le Lambda
    return new Date(timestamp).toLocaleDateString('fr-FR');
  }

  formatCurrency(cents: number): string {
    return (cents / 100).toFixed(2) + '€';
  }
}
