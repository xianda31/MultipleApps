import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { resolveGlyph } from '../../common/utilities/account-glyph.mapper';
import { Product } from '../products/product.interface';
import { ProductService } from '../../common/services/product.service';
import { BookService } from '../services/book.service';
import { ToastService } from '../../common/services/toast.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { StripeTerminalService, TerminalStatus } from '../shop/services/stripe-terminal.service';
import { ShopInitializationService } from '../shop/services/shop-initialization.service';
import { ShopProductService } from '../shop/services/shop-product.service';
import { PaymentMode } from '../shop/cart/cart.interface';

import {
  BookEntry,
  FINANCIAL_ACCOUNT,
  AMOUNTS,
  Operation,
  TRANSACTION_ID,
} from '../../common/interfaces/accounting.interface';

interface MiniCartItem {
  product: Product;
  quantity: number;
}

interface AccountAmount {
  account: string;
  amount: number;
}

@Component({
  selector: 'app-collecte-vente',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './collecte-vente.component.html',
  styleUrl: './collecte-vente.component.scss',
})
export class CollecteVenteComponent implements OnInit, OnDestroy {

  // ── Produits ──────────────────────────────────────────────
  /** Produits organisés par compte (même structure que Shop) */
  batchProductsMap: Map<string, Product[]> = new Map();
  miniCartItems: MiniCartItem[] = [];

  // ── TPE ───────────────────────────────────────────────────
  paymentMode = PaymentMode;
  selectedPaymentMode: PaymentMode = PaymentMode.CASH;
  tpePaymentActive: boolean = false;

  tpeStatus: TerminalStatus = 'idle';
  tpeReaderLabel: string = '';
  tpeReaderScanning: boolean = false;
  tpeReaderConnected: boolean = false;
  tpePaymentInProgress: boolean = false;
  saleSubmitInProgress: boolean = false;

  // ── Persistance comptable du jour ─────────────────────────
  todayLabel: string = '';
  eventTitle: string = '';
  cashAmount: number = 0;
  chequeAmount: number = 0;
  cbAccumulatedAmount: number = 0;
  cashEncaissementsCount: number = 0;
  chequeEncaissementsCount: number = 0;
  cbEncaissementsCount: number = 0;
  cashByAccount: AccountAmount[] = [];
  chequeByAccount: AccountAmount[] = [];
  cbByAccount: AccountAmount[] = [];

  // ── Session ───────────────────────────────────────────────
  private session = { date: '', season: '' };

  private subs: Subscription[] = [];

  constructor(
    private productService: ProductService,
    private shopProducts: ShopProductService,
    private bookService: BookService,
    private toastService: ToastService,
    private systemDataService: SystemDataService,
    private stripeTerminal: StripeTerminalService,
    private shopInit: ShopInitializationService,
  ) {}

  ngOnInit(): void {
    const today = new Date();
    this.session = {
      date: today.toISOString().split('T')[0],
      season: this.systemDataService.get_season(today),
    };
    this.todayLabel = this._formatDateFr(this.session.date);

    // Charger les produits batch (organisés par compte, paired en dernier)
    this.subs.push(
      this.productService.listProducts().subscribe((products) => {
        const batchOnly = products.filter((p) => !!p.batchEnabled && !!p.active);
        this.batchProductsMap = this.productService.products_by_accounts(batchOnly);
      }),
    );

    // Initialiser le TPE (idempotent — même logique que Shop)
    this.subs.push(
      this.systemDataService.get_configuration().subscribe((conf) => {
        this.tpePaymentActive = !!conf.tpe_payment_active;
        if (!this.tpePaymentActive && this.selectedPaymentMode === PaymentMode.CARD) {
          this.selectedPaymentMode = PaymentMode.CASH;
        }
        this.shopInit.initTPE(this.tpePaymentActive).catch(console.error);
      }),
    );

    // tpeReaderConnected : source autoritaire (AppSync sur PC, BLE sur Android)
    this.subs.push(
      this.shopInit.tpeReaderConnected$.subscribe((v) => (this.tpeReaderConnected = v)),
    );
    this.subs.push(
      this.shopInit.tpeReaderLabel$.subscribe((v) => (this.tpeReaderLabel = v)),
    );
    // tpeStatus : pour l'affichage de la phase de paiement (collecting, error…)
    this.subs.push(
      this.stripeTerminal.status$.subscribe((s) => (this.tpeStatus = s)),
    );
    this.subs.push(
      this.shopInit.tpeScanning$.subscribe((v) => (this.tpeReaderScanning = v)),
    );

    this.subs.push(
      this.bookService.list_book_entries().subscribe((entries) => {
        this._refreshCollecteState(entries);
      }),
    );
  }

  ngOnDestroy(): void {
    this.stripeTerminal.cancelRemotePayment();
    this.subs.forEach((s) => s.unsubscribe());
  }

  // ── Getters UI ────────────────────────────────────────────

  get isNativeAndroid(): boolean {
    return this.stripeTerminal.isNativeAndroid;
  }

  /** Sur PC : le SDK local n'est pas connecté — ppTPE gère la connexion via AppSync. */
  get tpeRemoteMode(): boolean {
    return !this.stripeTerminal.isNativeAndroid;
  }

  get tpeStatusLabel(): string {
    // En mode distant (PC), stripeTerminal.status$ reste 'idle' même quand le TPE
    // distant est connecté via AppSync. On se base sur tpeReaderConnected.
    if (this.tpeReaderConnected && (this.tpeStatus === 'idle' || this.tpeStatus === 'disconnected')) {
      return 'Connecté';
    }
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

  get miniCartTotal(): number {
    return this.miniCartItems.reduce((total, item) => total + item.product.price * item.quantity, 0);
  }

  get miniCartCount(): number {
    return this.miniCartItems.reduce((total, item) => total + item.quantity, 0);
  }

  get canAddProduct(): boolean {
    return !this.tpePaymentInProgress && !this.saleSubmitInProgress;
  }

  get canValidateMiniCart(): boolean {
    if (this.saleSubmitInProgress) return false;
    if (!this.eventTitle.trim()) return false;
    if (this.miniCartItems.length === 0) return false;
    if (this.selectedPaymentMode !== PaymentMode.CARD) return true;
    if (!this.tpePaymentActive) return false;
    return this.tpeReaderConnected;
  }

  selectPaymentMode(mode: PaymentMode): void {
    if (mode === PaymentMode.CARD && !this.tpePaymentActive) return;
    this.selectedPaymentMode = mode;
  }

  addToMiniCart(product: Product): void {
    if (!this.canAddProduct) return;
    const existingItem = this.miniCartItems.find((item) => item.product.id === product.id);
    if (existingItem) {
      existingItem.quantity += 1;
      return;
    }
    this.miniCartItems.push({ product, quantity: 1 });
  }

  increaseMiniCartItem(productId: string): void {
    const item = this.miniCartItems.find((entry) => entry.product.id === productId);
    if (item) item.quantity += 1;
  }

  decreaseMiniCartItem(productId: string): void {
    const item = this.miniCartItems.find((entry) => entry.product.id === productId);
    if (!item) return;
    item.quantity -= 1;
    if (item.quantity <= 0) {
      this.removeMiniCartItem(productId);
    }
  }

  removeMiniCartItem(productId: string): void {
    this.miniCartItems = this.miniCartItems.filter((item) => item.product.id !== productId);
  }

  clearMiniCart(): void {
    this.miniCartItems = [];
  }

  // ── TPE : scan & connexion ────────────────────────────────

  /** Relance la découverte BLE (Android uniquement — même logique que Shop). */
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

  // ── TPE : validation du mini-panier ──────────────────────

  async validateMiniCart(): Promise<void> {
    if (!this.canValidateMiniCart) return;
    this.saleSubmitInProgress = true;

    const total = Math.round(this.miniCartTotal * 100) / 100;
    const totalCents = Math.round(total * 100);
    const totalItems = this.miniCartCount;
    const valuesByAccount = this._buildMiniCartValuesByAccount();
    const titleTag = this.eventTitle.trim();

    await this._syncCollecteTagsForToday(titleTag);

    if (this.selectedPaymentMode === PaymentMode.CASH) {
      try {
        await this._upsertCollecteEntry(
          TRANSACTION_ID.dépôt_collecte_espèces,
          FINANCIAL_ACCOUNT.CASHBOX_debit,
          valuesByAccount,
          titleTag,
        );
        this.toastService.showSuccess('Encaissement espèces', `${totalItems} produit(s) — ${total} €`);
        this.clearMiniCart();
      } catch (err: any) {
        this.toastService.showError('Encaissement espèces', err?.message ?? 'Erreur de persistance comptable');
      } finally {
        this.saleSubmitInProgress = false;
      }
      return;
    }

    if (this.selectedPaymentMode === PaymentMode.CHEQUE) {
      try {
        await this._upsertCollecteEntry(
          TRANSACTION_ID.dépôt_collecte_chèques,
          FINANCIAL_ACCOUNT.CASHBOX_debit,
          valuesByAccount,
          titleTag,
        );
        this.toastService.showSuccess('Encaissement chèque', `${totalItems} produit(s) — ${total} €`);
        this.clearMiniCart();
      } catch (err: any) {
        this.toastService.showError('Encaissement chèque', err?.message ?? 'Erreur de persistance comptable');
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

    // Sur PC : ppTPE gère la connexion BLE — passer par le relay AppSync (service)
    if (this.tpeRemoteMode) {
      this.stripeTerminal.startRemotePayment(
        { amountCents: totalCents, memberName: 'Collecte', season: this.session.season, date: this.session.date },
        {
          onSuccess: async () => {
            this.tpePaymentInProgress = false;
            try {
              await this._upsertCollecteEntry(
                TRANSACTION_ID.collecte_par_cb,
                FINANCIAL_ACCOUNT.STRIPE_debit,
                valuesByAccount,
                titleTag,
              );
              this.toastService.showSuccess('CB acceptée', `${totalItems} produit(s) — ${total} €`);
            } catch (err: any) {
              this.toastService.showError('Paiement CB', err?.message ?? 'Paiement validé mais persistance comptable en erreur');
            } finally {
              this.saleSubmitInProgress = false;
            }
            this.clearMiniCart();
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
        },
      ).catch((err) => {
        this.toastService.showError('Paiement CB', err.message || 'Erreur PaymentRequest');
        this.tpePaymentInProgress = false;
        this.saleSubmitInProgress = false;
      });
      return;
    }

    // Android local BLE : SDK directement connecté
    try {
      const { clientSecret } = await this.stripeTerminal.createPaymentIntent({
        amountCents: totalCents,
        memberName: 'Collecte',
        season: this.session.season,
        date: this.session.date,
      });
      await this.stripeTerminal.collectAndProcess(clientSecret);

      await this._upsertCollecteEntry(
        TRANSACTION_ID.collecte_par_cb,
        FINANCIAL_ACCOUNT.STRIPE_debit,
        valuesByAccount,
        titleTag,
      );
      this.toastService.showSuccess('CB acceptée', `${totalItems} produit(s) — ${total} €`);
      this.clearMiniCart();
    } catch (err: any) {
      this.toastService.showError('Paiement CB', err.message ?? 'Erreur TPE');
      this.stripeTerminal.resetStatus();
    } finally {
      this.tpePaymentInProgress = false;
      this.saleSubmitInProgress = false;
    }
  }

  private async _upsertCollecteEntry(
    transactionId: TRANSACTION_ID,
    financialAccount: FINANCIAL_ACCOUNT,
    deltaByAccount: Record<string, number>,
    tag: string,
  ): Promise<void> {
    const date = this._todayIso();
    const season = this.systemDataService.get_season(new Date(date));
    const existing = this.bookService.get_book_entries().find(
      (entry) => entry.date === date && entry.transaction_id === transactionId,
    );

    if (!existing) {
      const total = this._sumValues(deltaByAccount);
      const encaissementsCount = 1;
      const entry: BookEntry = {
        id: '',
        season,
        date,
        tag,
        amounts: { [financialAccount]: total },
        operations: [{ label: this._encaissementsLabel(encaissementsCount), values: { ...deltaByAccount } }],
        transaction_id: transactionId,
      };
      await this.bookService.create_book_entry(entry);
      return;
    }

    const mergedByAccount = this._mergeValues(this._extractEntryAccountValues(existing), deltaByAccount);
    const total = this._sumValues(mergedByAccount);
    const encaissementsCount = this._extractEncaissementsCount(existing) + 1;
    const updatedEntry: BookEntry = {
      ...existing,
      season,
      date,
      tag,
      amounts: {
        ...existing.amounts,
        [financialAccount]: total,
      },
      operations: [{ label: this._encaissementsLabel(encaissementsCount), values: mergedByAccount }],
    };
    await this.bookService.update_book_entry(updatedEntry);
  }

  private _refreshCollecteState(entries: BookEntry[]): void {
    const date = this._todayIso();
    const cash = entries.find((entry) => entry.date === date && entry.transaction_id === TRANSACTION_ID.dépôt_collecte_espèces);
    const cheque = entries.find((entry) => entry.date === date && entry.transaction_id === TRANSACTION_ID.dépôt_collecte_chèques);
    const cb = entries.find((entry) => entry.date === date && entry.transaction_id === TRANSACTION_ID.collecte_par_cb);

    if (!this.eventTitle.trim()) {
      const existingTag = [cash, cheque, cb].find((entry) => !!entry?.tag)?.tag;
      if (existingTag) this.eventTitle = existingTag;
    }

    this.cashAmount = this._entryFinancialAmount(cash, FINANCIAL_ACCOUNT.CASHBOX_debit);
    this.chequeAmount = this._entryFinancialAmount(cheque, FINANCIAL_ACCOUNT.CASHBOX_debit);
    this.cbAccumulatedAmount = this._entryFinancialAmount(cb, FINANCIAL_ACCOUNT.STRIPE_debit);
    this.cashEncaissementsCount = cash ? this._extractEncaissementsCount(cash) : 0;
    this.chequeEncaissementsCount = cheque ? this._extractEncaissementsCount(cheque) : 0;
    this.cbEncaissementsCount = cb ? this._extractEncaissementsCount(cb) : 0;

    this.cashByAccount = this._toAccountAmountRows(this._extractEntryAccountValues(cash));
    this.chequeByAccount = this._toAccountAmountRows(this._extractEntryAccountValues(cheque));
    this.cbByAccount = this._toAccountAmountRows(this._extractEntryAccountValues(cb));
  }

  private _entryFinancialAmount(entry: BookEntry | undefined, financialAccount: FINANCIAL_ACCOUNT): number {
    if (!entry) return 0;
    return Math.round(((entry.amounts[financialAccount] ?? 0) as number) * 100) / 100;
  }

  private _buildMiniCartValuesByAccount(): Record<string, number> {
    const values: Record<string, number> = {};
    this.miniCartItems.forEach((item) => {
      const key = item.product.account;
      const amount = item.product.price * item.quantity;
      values[key] = Math.round(((values[key] ?? 0) + amount) * 100) / 100;
    });
    return values;
  }

  private _extractEntryAccountValues(entry: BookEntry | undefined): Record<string, number> {
    const values: Record<string, number> = {};
    if (!entry) return values;

    entry.operations.forEach((operation) => {
      Object.entries(operation.values).forEach(([account, amount]) => {
        values[account] = Math.round(((values[account] ?? 0) + amount) * 100) / 100;
      });
    });
    return values;
  }

  private _mergeValues(base: Record<string, number>, delta: Record<string, number>): Record<string, number> {
    const merged: Record<string, number> = { ...base };
    Object.entries(delta).forEach(([account, amount]) => {
      merged[account] = Math.round(((merged[account] ?? 0) + amount) * 100) / 100;
    });
    return merged;
  }

  private _sumValues(values: Record<string, number>): number {
    return Math.round((Object.values(values).reduce((sum, amount) => sum + amount, 0)) * 100) / 100;
  }

  private _toAccountAmountRows(values: Record<string, number>): AccountAmount[] {
    return Object.entries(values)
      .map(([account, amount]) => ({ account, amount }))
      .sort((a, b) => a.account.localeCompare(b.account));
  }

  private _todayIso(): string {
    return new Date().toISOString().split('T')[0];
  }

  private _extractEncaissementsCount(entry: BookEntry): number {
    const label = entry.operations?.[0]?.label ?? '';
    const match = label.match(/^(\d+)\s+encaissements?$/i);
    if (!match) return 0;
    const count = Number(match[1]);
    return Number.isFinite(count) ? count : 0;
  }

  private _encaissementsLabel(count: number): string {
    return `${count} encaissements`;
  }

  private async _syncCollecteTagsForToday(title: string): Promise<void> {
    const date = this._todayIso();
    const entries = this.bookService.get_book_entries().filter((entry) =>
      entry.date === date && [
        TRANSACTION_ID.dépôt_collecte_espèces,
        TRANSACTION_ID.dépôt_collecte_chèques,
        TRANSACTION_ID.collecte_par_cb,
      ].includes(entry.transaction_id),
    );

    const updates = entries
      .filter((entry) => entry.tag !== title)
      .map((entry) => this.bookService.update_book_entry({ ...entry, tag: title }));

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  }

  private _formatDateFr(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  }

  // ── Utilitaires ───────────────────────────────────────────

  getProductGradientStyle(product: Product): string {
    return this.shopProducts.getProductGradientStyle(product);
  }

  getProductGlyph(product: Product): string {
    return resolveGlyph(product.account, product.glyph);
  }
}
