import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { Product } from '../products/product.interface';
import { ProductService } from '../../common/services/product.service';
import { BookService } from '../services/book.service';
import { ToastService } from '../../common/services/toast.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { StripeTerminalService, TerminalStatus } from '../shop/services/stripe-terminal.service';
import { ShopInitializationService } from '../shop/services/shop-initialization.service';
import { CardPaymentOrchestratorService } from '../services/card-payment-orchestrator.service';
import { PaymentMode } from '../shop/cart/cart.interface';
import { SurveyResultsService } from '../sondage/survey-results.service';
import { SondageService, SurveyItem } from '../sondage/sondage.service';

import {
  BookEntry,
  FINANCIAL_ACCOUNT,
  TRANSACTION_ID,
} from '../../common/interfaces/accounting.interface';
import { TRANSACTION_DIRECTORY } from '../../common/interfaces/transaction.definition';
import { TicketingPayment, TicketingService, TicketingReservation } from './ticketing.service';

interface ReservationView extends TicketingReservation {
  selected: boolean;
  price: number;
  product: Product | null;
}

@Component({
  selector: 'app-billetterie',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './collecte-vente.component.html',
  styleUrl: './collecte-vente.component.scss',
})
export class BilletterieComponent implements OnInit, OnDestroy {
  paymentMode = PaymentMode;
  selectedPaymentMode: PaymentMode = PaymentMode.CASH;
  tpePaymentActive = false;

  tpeStatus: TerminalStatus = 'idle';
  tpeReaderLabel = '';
  tpeReaderScanning = false;
  tpeReaderConnected = false;
  tpePaymentInProgress = false;
  saleSubmitInProgress = false;
  accountingInProgress = false;

  todayLabel = '';
  eventTitle = '';

  memberProduct: Product | null = null;
  nonMemberProduct: Product | null = null;
  private batchProducts: Product[] = [];

  reservations: ReservationView[] = [];
  soldReservations: ReservationView[] = [];
  payments: TicketingPayment[] = [];

  memberFilter = '';
  showOnlyUnpaid = true;

  // ── Ingestion sondage ─────────────────────────────────────────────────────
  availableSurveys: SurveyItem[] = [];
  selectedSurveyId = '';
  loadingSurveys = false;
  importingSurvey = false;

  soldCount = 0;
  notSoldCount = 0;
  chequeAmountsByValue: Array<{ amount: number; count: number }> = [];
  cashAmount = 0;
  cbAccumulatedAmount = 0;

  private session = { date: '', season: '' };
  private subs: Subscription[] = [];

  constructor(
    private productService: ProductService,
    private ticketingService: TicketingService,
    private bookService: BookService,
    private toastService: ToastService,
    private systemDataService: SystemDataService,
    private stripeTerminal: StripeTerminalService,
    private shopInit: ShopInitializationService,
    private cardPaymentOrchestrator: CardPaymentOrchestratorService,
    private surveyResults: SurveyResultsService,
    private sondageService: SondageService,
  ) {}

  ngOnInit(): void {
    const today = new Date();
    this.session = {
      date: today.toISOString().split('T')[0],
      season: this.systemDataService.get_season(today),
    };
    this.todayLabel = this._formatDateFr(this.session.date);

    this.subs.push(
      this.productService.listProducts().subscribe((products) => {
        this.batchProducts = products.filter((p) => !!p.batchEnabled && !!p.active);
        this._resolvePricingProducts();
        this._applyPricing();
      }),
    );

    this.subs.push(
      this.systemDataService.get_configuration().subscribe((conf) => {
        this.tpePaymentActive = !!conf.tpe_payment_active;
        if (!this.tpePaymentActive && this.selectedPaymentMode === PaymentMode.CARD) {
          this.selectedPaymentMode = PaymentMode.CASH;
        }
        this.shopInit.initTPE(this.tpePaymentActive).catch(console.error);
      }),
    );

    this.subs.push(this.shopInit.tpeReaderConnected$.subscribe((v) => (this.tpeReaderConnected = v)));
    this.subs.push(this.shopInit.tpeReaderLabel$.subscribe((v) => (this.tpeReaderLabel = v)));
    this.subs.push(this.stripeTerminal.status$.subscribe((s) => (this.tpeStatus = s)));
    this.subs.push(this.shopInit.tpeScanning$.subscribe((v) => (this.tpeReaderScanning = v)));

    void this.refreshFromDb();
    void this.loadAvailableSurveys();
  }

  ngOnDestroy(): void {
    this.cardPaymentOrchestrator.cancelRemotePayment();
    this.subs.forEach((s) => s.unsubscribe());
  }

  get isNativeAndroid(): boolean {
    return this.stripeTerminal.isNativeAndroid;
  }

  get tpeRemoteMode(): boolean {
    return this.cardPaymentOrchestrator.isRemoteMode;
  }

  get tpeStatusLabel(): string {
    if (this.tpeReaderConnected && (this.tpeStatus === 'idle' || this.tpeStatus === 'disconnected')) return 'Connecté';
    const labels: Record<TerminalStatus, string> = {
      idle: 'Déconnecté',
      connecting: 'Connexion…',
      connected: 'Connecté',
      collecting: 'Lecture carte…',
      success: 'Accepté',
      error: 'Erreur',
      disconnected: 'Déconnecté',
    };
    return labels[this.tpeStatus] ?? this.tpeStatus;
  }

  get tpeStatusClass(): string {
    if (this.tpeReaderConnected) return 'text-success';
    if (this.tpeStatus === 'error') return 'text-danger';
    return 'text-secondary';
  }

  get filteredReservations(): ReservationView[] {
    const term = this._normalize(this.memberFilter);
    return this.reservations
      .filter((row) => {
        if (this.showOnlyUnpaid && row.reservationStatus === 'sold') return false;
        if (!term) return true;
        return this._normalize(row.memberName).includes(term);
      })
      .sort((a, b) => a.memberName.localeCompare(b.memberName, 'fr', { sensitivity: 'base' }));
  }

  get selectedCount(): number {
    return this.reservations.filter((row) => row.selected).length;
  }

  get selectedTotal(): number {
    return Math.round(
      this.reservations
        .filter((row) => row.selected)
        .reduce((sum, row) => sum + row.price, 0) * 100,
    ) / 100;
  }

  get canValidateMiniCart(): boolean {
    if (this.saleSubmitInProgress || this.accountingInProgress) return false;
    if (!this.eventTitle.trim()) return false;
    if (this.selectedCount === 0) return false;
    if (!this.memberProduct || !this.nonMemberProduct) return false;
    if (this.selectedPaymentMode !== PaymentMode.CARD) return true;
    return this.tpePaymentActive && this.tpeReaderConnected;
  }

  get canWriteAccountingEntry(): boolean {
    return !this.accountingInProgress
      && !!this.eventTitle.trim()
      && this.soldReservations.some((row) => !row.accountedAt);
  }

  get activePayments(): TicketingPayment[] {
    return this.payments.filter((payment) => payment.status !== 'cancelled');
  }

  selectPaymentMode(mode: PaymentMode): void {
    if (mode === PaymentMode.CARD && !this.tpePaymentActive) return;
    this.selectedPaymentMode = mode;
  }

  toggleReservationSelection(id: string): void {
    const row = this.reservations.find((r) => r.id === id);
    if (!row) return;
    row.selected = !row.selected;
  }

  selectAllVisibleUnpaid(): void {
    this.filteredReservations
      .filter((row) => row.reservationStatus !== 'sold')
      .forEach((row) => {
        row.selected = true;
      });
  }

  clearSelection(): void {
    this.reservations.forEach((row) => {
      row.selected = false;
    });
  }

  async scanAndConnect(): Promise<void> {
    await this.shopInit.retryBLEDiscovery();
  }

  async disconnect(): Promise<void> {
    try {
      await this.stripeTerminal.disconnectReader();
      this.shopInit.notifyDisconnected();
    } catch (err: any) {
      this.toastService.showError('TPE', err.message ?? 'Erreur lors de la déconnexion');
    }
  }

  async validateMiniCart(): Promise<void> {
    if (!this.canValidateMiniCart) return;

    const selected = this.reservations.filter((row) => row.selected);
    if (selected.length === 0) return;

    this.saleSubmitInProgress = true;

    const persistSale = async () => {
      const total = Math.round(selected.reduce((sum, row) => sum + row.price, 0) * 100) / 100;
      const payment = await this.ticketingService.createPayment({
        season: this.session.season,
        date: this.session.date,
        eventTitle: this.eventTitle.trim(),
        paymentMode: this._toTicketingMode(this.selectedPaymentMode),
        totalAmount: total,
        reservationCount: selected.length,
      });

      await this.ticketingService.markReservationsSold({
        reservationIds: selected.map((row) => row.id),
        paymentId: payment.id,
        paymentMode: this._toTicketingMode(this.selectedPaymentMode),
        paidByReservationId: Object.fromEntries(
          selected.map((row) => [
            row.id,
            {
              amount: row.price,
              account: row.product?.account ?? '',
              productId: row.product?.id ?? '',
            },
          ]),
        ),
      });
    };

    if (this.selectedPaymentMode === PaymentMode.CASH || this.selectedPaymentMode === PaymentMode.CHEQUE) {
      try {
        await persistSale();
        this.toastService.showSuccess('Billetterie', `${selected.length} réservation(s) encaissée(s)`);
        await this.refreshFromDb();
      } catch (err: any) {
        this.toastService.showError('Billetterie', err?.message ?? 'Erreur de persistance ticketing');
      } finally {
        this.saleSubmitInProgress = false;
      }
      return;
    }

    if (!this.tpePaymentActive || !this.tpeReaderConnected || this.tpePaymentInProgress) {
      this.saleSubmitInProgress = false;
      return;
    }

    this.tpePaymentInProgress = true;

    const total = Math.round(selected.reduce((sum, row) => sum + row.price, 0) * 100) / 100;
    const paymentParams = {
      amountCents: Math.round(total * 100),
      memberName: 'Ticketing',
      season: this.session.season,
      date: this.session.date,
    };

    const onSuccess = async () => {
      await persistSale();
      this.toastService.showSuccess('Paiement CB', `${selected.length} réservation(s) encaissée(s)`);
      await this.refreshFromDb();
    };

    if (this.tpeRemoteMode) {
      this.cardPaymentOrchestrator.payByCard(paymentParams, {
        onSuccess: async () => {
          this.tpePaymentInProgress = false;
          try {
            await onSuccess();
          } catch (err: any) {
            this.toastService.showError('Paiement CB', err?.message ?? 'Paiement validé mais persistance en erreur');
          } finally {
            this.saleSubmitInProgress = false;
          }
        },
        onFailed: (msg) => {
          this.tpePaymentInProgress = false;
          this.saleSubmitInProgress = false;
          this.toastService.showError('Paiement CB', msg);
        },
        onCancelled: () => {
          this.tpePaymentInProgress = false;
          this.saleSubmitInProgress = false;
          this.toastService.showWarning('Paiement CB', 'Paiement annulé');
        },
        onTimeout: () => {
          this.tpePaymentInProgress = false;
          this.saleSubmitInProgress = false;
          this.toastService.showWarning('TPE', 'TPE ne répond pas — paiement annulé');
        },
        onError: () => {
          this.tpePaymentInProgress = false;
          this.saleSubmitInProgress = false;
          this.toastService.showError('TPE', 'Connexion AppSync perdue');
        },
      }).catch((err) => {
        this.toastService.showError('Paiement CB', err.message || 'Erreur PaymentRequest');
        this.tpePaymentInProgress = false;
        this.saleSubmitInProgress = false;
      });
      return;
    }

    try {
      await this.cardPaymentOrchestrator.payByCard(paymentParams, {
        onSuccess,
        onFailed: (msg) => this.toastService.showError('Paiement CB', msg),
        onCancelled: () => this.toastService.showWarning('Paiement CB', 'Paiement annulé'),
        onTimeout: () => this.toastService.showWarning('TPE', 'TPE ne répond pas — paiement annulé'),
        onError: () => this.toastService.showError('TPE', 'Connexion AppSync perdue'),
      });
    } catch (err: any) {
      this.toastService.showError('Paiement CB', err.message ?? 'Erreur TPE');
      this.stripeTerminal.resetStatus();
    } finally {
      this.tpePaymentInProgress = false;
      this.saleSubmitInProgress = false;
    }
  }

  async writeAccountingEntry(): Promise<void> {
    if (!this.canWriteAccountingEntry) return;

    const pending = this.soldReservations.filter((row) => !row.accountedAt);
    if (pending.length === 0) return;

    this.accountingInProgress = true;

    try {
      await this._writeModeAccounting(PaymentMode.CASH, pending.filter((row) => row.paymentMode === 'cash'));
      await this._writeModeAccounting(PaymentMode.CHEQUE, pending.filter((row) => row.paymentMode === 'cheque'));
      await this._writeModeAccounting(PaymentMode.CARD, pending.filter((row) => row.paymentMode === 'card'));

      await this.ticketingService.markAccounted({
        reservationIds: pending.map((row) => row.id),
        paymentIds: [...new Set(pending.map((row) => row.paymentId).filter((id): id is string => !!id))],
      });

      this.toastService.showSuccess('Comptabilité', `${pending.length} réservation(s) intégrée(s) en compta`);
      await this.refreshFromDb();
    } catch (err: any) {
      this.toastService.showError('Comptabilité', err?.message ?? 'Erreur lors de l\'écriture comptable');
    } finally {
      this.accountingInProgress = false;
    }
  }

  exportBilletterieCsv(): void {
    const headers = ['nom', 'adhérent', 'montant réglé', 'type de paiement'];
    const rows = this.soldReservations
      .sort((a, b) => a.memberName.localeCompare(b.memberName, 'fr', { sensitivity: 'base' }))
      .map((row) => [
        row.memberName,
        row.isMember ? 'oui' : 'non',
        (row.paidAmount ?? 0).toFixed(2),
        row.paymentId && this._paymentIsGrouped(row.paymentId) ? 'autre' : this._paymentLabel(row.paymentMode),
      ]);

    const csv = [headers, ...rows].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ticketing-${this.session.date}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async refreshFromDb(): Promise<void> {
    try {
      if (!this.eventTitle.trim()) {
        const fromDate = await this.ticketingService.listReservationsForDate(this.session.date);
        if (fromDate.length === 1) {
          this.eventTitle = fromDate[0].eventTitle;
        }
      }

      if (!this.eventTitle.trim()) {
        this.reservations = [];
        this.soldReservations = [];
        this.payments = [];
        this._refreshSummary();
        return;
      }

      const [allReservations, payments] = await Promise.all([
        this.ticketingService.listReservations(this.session.date, this.eventTitle.trim()),
        this.ticketingService.listPayments(this.session.date, this.eventTitle.trim()),
      ]);
      this.reservations = allReservations
        .filter((row) => row.reservationStatus !== 'sold')
        .map((row) => ({ ...row, selected: false, ...this._priceForReservation(row) }));

      this.soldReservations = allReservations
        .filter((row) => row.reservationStatus === 'sold')
        .map((row) => ({ ...row, selected: false, ...this._priceForReservation(row) }));

      this.payments = payments;

      this._refreshSummary();
    } catch (err: any) {
      this.toastService.showError('Billetterie', err?.message ?? 'Erreur de chargement ticketing');
    }
  }

  onEventTitleBlur(): void {
    void this.refreshFromDb();
  }

  onSurveySelected(surveyId: string): void {
    if (!surveyId) {
      this.eventTitle = '';
      void this.refreshFromDb();
      return;
    }
    const survey = this.availableSurveys.find(s => s.id === surveyId);
    if (survey?.title) {
      this.eventTitle = survey.title;
    }
    void this.importFromSurvey();
  }

  async loadAvailableSurveys(): Promise<void> {
    this.loadingSurveys = true;
    try {
      this.availableSurveys = await this.sondageService.listSurveys();
    } catch (err: any) {
      this.toastService.showError('Billetterie', err?.message ?? 'Erreur de chargement des sondages');
    } finally {
      this.loadingSurveys = false;
    }
  }

  async importFromSurvey(): Promise<void> {
    if (!this.selectedSurveyId) {
      this.toastService.showWarning('Billetterie', 'Sélectionnez un sondage.');
      return;
    }
    if (!this.eventTitle.trim()) {
      this.toastService.showWarning('Billetterie', 'Renseignez le titre de l\'\u00e9vénement avant import.');
      return;
    }

    this.importingSurvey = true;
    try {
      const rows = await this.surveyResults.getReservationsFromSurvey(this.selectedSurveyId);
      if (rows.length === 0) {
        this.toastService.showWarning('Billetterie', 'Aucune réservation valide dans ce sondage (aucun présent).');
        return;
      }

      const result = await this.ticketingService.importReservations(rows, {
        date: this.session.date,
        season: this.session.season,
        eventTitle: this.eventTitle.trim(),
        source: `survey:${this.selectedSurveyId}`,
      });

      this.toastService.showSuccess('Billetterie', `${result.created} créée(s), ${result.updated} mise(s) à jour`);
      await this.refreshFromDb();
    } catch (err: any) {
      this.toastService.showError('Billetterie', err?.message ?? 'Erreur d\'import depuis le sondage');
    } finally {
      this.importingSurvey = false;
    }
  }

  canCancelPayment(payment: TicketingPayment): boolean {
    return payment.status !== 'cancelled' && !payment.accountedAt && !this.saleSubmitInProgress && !this.accountingInProgress;
  }

  getPaymentLinkedNames(payment: TicketingPayment): string {
    const linkedNames = this.soldReservations
      .filter((row) => row.paymentId === payment.id)
      .map((row) => row.memberName);

    if (linkedNames.length === 0) {
      return payment.status === 'cancelled'
        ? 'réservations relibérées'
        : 'noms indisponibles';
    }

    return linkedNames.join(', ');
  }

  getPaymentModeLabel(mode: string | null | undefined): string {
    return this._paymentLabel(mode);
  }

  async cancelPayment(payment: TicketingPayment): Promise<void> {
    if (!this.canCancelPayment(payment)) return;
    if (!confirm(`Annuler le paiement de ${payment.totalAmount?.toFixed(2) ?? '0.00'} € ?`)) return;

    try {
      await this.ticketingService.cancelPayment(payment);
      this.toastService.showSuccess('Billetterie', 'Paiement annulé, réservations relibérées.');
      await this.refreshFromDb();
    } catch (err: any) {
      this.toastService.showError('Billetterie', err?.message ?? 'Erreur lors de l\'annulation du paiement');
    }
  }

  private async _writeModeAccounting(mode: PaymentMode, reservations: ReservationView[]): Promise<void> {
    if (reservations.length === 0) return;

    const valuesByAccount: Record<string, number> = {};
    reservations.forEach((row) => {
      const key = row.paidAccount?.trim() || row.product?.account || '';
      const amount = Math.round((row.paidAmount ?? row.price ?? 0) * 100) / 100;
      if (!key || amount <= 0) return;
      valuesByAccount[key] = Math.round(((valuesByAccount[key] ?? 0) + amount) * 100) / 100;
    });

    if (Object.keys(valuesByAccount).length === 0) return;

    const transactionId = this._transactionIdForMode(mode);
    const financialAccount = this._getCollecteFinancialAccount(transactionId);
    const total = Math.round(Object.values(valuesByAccount).reduce((sum, amount) => sum + amount, 0) * 100) / 100;

    const entry: BookEntry = {
      id: '',
      season: this.session.season,
      date: this.session.date,
      tag: this.eventTitle.trim(),
      amounts: { [financialAccount]: total },
      operations: [{ label: `${reservations.length} encaissements billetterie`, values: valuesByAccount }],
      transaction_id: transactionId,
    };

    await this.bookService.create_book_entry(entry);
  }

  private _refreshSummary(): void {
    this.soldCount = this.soldReservations.length;
    this.notSoldCount = this.reservations.length;

    this.cashAmount = Math.round(
      this.activePayments
        .filter((payment) => payment.paymentMode === 'cash')
        .reduce((sum, payment) => sum + (payment.totalAmount ?? 0), 0) * 100,
    ) / 100;

    this.cbAccumulatedAmount = Math.round(
      this.activePayments
        .filter((payment) => payment.paymentMode === 'card')
        .reduce((sum, payment) => sum + (payment.totalAmount ?? 0), 0) * 100,
    ) / 100;

    const cheques = new Map<number, number>();
    this.activePayments
      .filter((payment) => payment.paymentMode === 'cheque')
      .forEach((payment) => {
        const amount = Math.round((payment.totalAmount ?? 0) * 100) / 100;
        cheques.set(amount, (cheques.get(amount) ?? 0) + 1);
      });

    this.chequeAmountsByValue = [...cheques.entries()]
      .map(([amount, count]) => ({ amount, count }))
      .sort((a, b) => b.amount - a.amount);
  }

  private _resolvePricingProducts(): void {
    const byText = (product: Product) => this._normalize(`${product.name} ${product.productCode ?? ''}`);

    this.memberProduct = this.batchProducts.find((product) => /adh|member/.test(byText(product))) ?? this.batchProducts[0] ?? null;
    this.nonMemberProduct = this.batchProducts.find((product) => /non|ext|guest|invite/.test(byText(product)))
      ?? this.batchProducts.find((product) => product.id !== this.memberProduct?.id)
      ?? this.memberProduct;
  }

  private _applyPricing(): void {
    this.reservations = this.reservations.map((row) => ({ ...row, ...this._priceForReservation(row) }));
    this.soldReservations = this.soldReservations.map((row) => ({ ...row, ...this._priceForReservation(row) }));
  }

  private _priceForReservation(reservation: TicketingReservation): { price: number; product: Product | null } {
    const product = reservation.isMember ? this.memberProduct : this.nonMemberProduct;
    return { price: product?.price ?? 0, product };
  }

  private _paymentIsGrouped(paymentId: string): boolean {
    return this.soldReservations.filter((row) => row.paymentId === paymentId).length > 1;
  }

  private _paymentLabel(mode: string | null | undefined): string {
    if (mode === 'cash') return 'espèces';
    if (mode === 'cheque') return 'chèque';
    if (mode === 'card') return 'CB';
    return 'autre';
  }

  private _toTicketingMode(mode: PaymentMode): 'cash' | 'cheque' | 'card' | 'other' {
    if (mode === PaymentMode.CHEQUE) return 'cheque';
    if (mode === PaymentMode.CARD) return 'card';
    return 'cash';
  }

  private _transactionIdForMode(mode: PaymentMode): TRANSACTION_ID {
    if (mode === PaymentMode.CHEQUE) return TRANSACTION_ID.dépôt_collecte_chèques;
    if (mode === PaymentMode.CARD) return TRANSACTION_ID.collecte_par_cb;
    return TRANSACTION_ID.dépôt_collecte_espèces;
  }

  private _getCollecteFinancialAccount(transactionId: TRANSACTION_ID): FINANCIAL_ACCOUNT {
    const mapping = TRANSACTION_DIRECTORY[transactionId]?.financial_accounts_to_charge ?? [];
    const account = mapping.find((key) => this._isFinancialAccount(key));
    if (!account) {
      throw new Error(`Aucun compte financier défini dans TRANSACTION_DIRECTORY pour ${transactionId}`);
    }
    return account;
  }

  private _isFinancialAccount(key: unknown): key is FINANCIAL_ACCOUNT {
    return Object.values(FINANCIAL_ACCOUNT).includes(key as FINANCIAL_ACCOUNT);
  }

  private _normalize(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private _formatDateFr(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  }
}
