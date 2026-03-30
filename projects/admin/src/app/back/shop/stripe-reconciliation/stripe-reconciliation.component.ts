import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DBhandler } from '../../../common/services/graphQL.service';
import { BookService } from '../../services/book.service';
import { CartService } from '../cart/cart.service';
import { MembersService } from '../../../common/services/members.service';
import { ProductService } from '../../../common/services/product.service';
import { SystemDataService } from '../../../common/services/system-data.service';
import { ToastService } from '../../../common/services/toast.service';
import { Member } from '../../../common/interfaces/member.interface';
import { Product } from '../../products/product.interface';
import { PaymentMode } from '../cart/cart.interface';
import { TRANSACTION_ID } from '../../../common/interfaces/accounting.interface';
import { getShortStripeTag } from '../../../common/utilities/stripe-utils';

interface PendingTransaction {
  id: string;
  stripeSessionId: string;
  buyerMemberId: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  createdAt: string;
  stripeMeta: {
    cartSnapshot: string;
    season: string;
    date: string;
    memberName: string;
    debtAmountCents: string;
    assetAmountCents: string;
  };
  // enrichi côté frontend
  buyerName?: string;
  cartSummary?: string;
  alreadyBooked?: boolean;
}

@Component({
  selector: 'app-stripe-reconciliation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stripe-reconciliation.component.html',
})
export class StripeReconciliationComponent {
  pending: PendingTransaction[] = [];
  loading = true;
  processing = new Set<string>();

  private members: Member[] = [];
  private products: Product[] = [];
  private bookEntriesLoaded = false;

  constructor(
    private dbHandler: DBhandler,
    private bookService: BookService,
    private cartService: CartService,
    private membersService: MembersService,
    private productService: ProductService,
    private systemDataService: SystemDataService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    // Charger membres, produits et écritures comptables, puis vérifier
    this.bookService.list_book_entries().subscribe(() => {
      this.bookEntriesLoaded = true;

      this.membersService.listMembers().subscribe((members) => {
        this.members = members;

        this.productService.listProducts().subscribe((products) => {
          this.products = products;
          this.loadPendingTransactions();
        });
      });
    });
  }

  async loadPendingTransactions(): Promise<void> {
    this.loading = true;
    try {
      const raw = await this.dbHandler.listUnprocessedStripeTransactions();
      this.pending = raw.map((t: any) => this.enrichTransaction(t)).filter(t => !t.alreadyBooked);
    } catch (error) {
      console.error('Erreur chargement transactions Stripe:', error);
      this.toastService.showErrorToast('Réconciliation', 'Impossible de charger les transactions Stripe');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Enrichit une StripeTransaction brute avec des infos lisibles
   * et vérifie si un BookEntry avec tag stripe:<sessionId> existe déjà
   */
  private enrichTransaction(t: any): PendingTransaction {
    const meta = (typeof t.stripeMeta === 'string' ? JSON.parse(t.stripeMeta) : t.stripeMeta) || {};
    const pt: PendingTransaction = {
      id: t.id,
      stripeSessionId: t.stripeSessionId || t.id,
      buyerMemberId: t.buyerMemberId || '',
      amountCents: t.amountCents,
      currency: t.currency,
      customerEmail: t.customerEmail || '',
      createdAt: t.createdAt || '',
      stripeMeta: {
        cartSnapshot: meta.cartSnapshot || '[]',
        season: meta.season || '',
        date: meta.date || '',
        memberName: meta.memberName || '',
        debtAmountCents: meta.debtAmountCents || '0',
        assetAmountCents: meta.assetAmountCents || '0',
      },
    };

    // Résoudre le nom de l'acheteur
    const member = this.members.find(m => m.id === pt.buyerMemberId);
    pt.buyerName = member
      ? member.lastname + ' ' + member.firstname
      : pt.stripeMeta.memberName || pt.customerEmail || '(inconnu)';

    // Résumé du panier
    try {
      const snapshot: Array<{ productId: string }> = JSON.parse(pt.stripeMeta.cartSnapshot);
      const names = snapshot.map(item => {
        const prod = this.products.find(p => p.id === item.productId);
        return prod?.name || item.productId;
      });
      pt.cartSummary = names.join(', ') || '(vide)';
    } catch {
      pt.cartSummary = '(erreur parsing)';
    }

    // Vérifier si un BookEntry existe déjà pour cette session
    const stripeTag = getShortStripeTag(pt.stripeSessionId);
    const existingEntry = this.bookService.get_book_entries()
      .find(e => e.stripeTag === stripeTag);
    pt.alreadyBooked = !!existingEntry;

    return pt;
  }

  formatAmount(cents: number): string {
    return (cents / 100).toFixed(2) + ' €';
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  /**
   * Traite une transaction : reconstruit le panier et crée BookEntry + GameCard
   * via les services Angular existants (aucun code métier dupliqué)
   */
  async processTransaction(tx: PendingTransaction): Promise<void> {
    if (this.processing.has(tx.id)) return;
    this.processing.add(tx.id);

    try {
      const buyer = this.members.find(m => m.id === tx.buyerMemberId);
      if (!buyer) {
        this.toastService.showErrorToast('Réconciliation', `Membre introuvable: ${tx.buyerMemberId}`);
        return;
      }

      const snapshot: Array<{ productId: string; pairedMemberId?: string }> =
        JSON.parse(tx.stripeMeta.cartSnapshot);

      if (!snapshot.length) {
        this.toastService.showWarning('Réconciliation', 'Panier vide — transaction ignorée');
        await this.markProcessed(tx);
        return;
      }

      // Reconstruire le panier via CartService (même logique que shop)
      this.cartService.clearCart();
      this.cartService.setSeller('en ligne');
      this.cartService.setBuyer(buyer.lastname + ' ' + buyer.firstname);

      for (const item of snapshot) {
        const product = this.products.find(p => p.id === item.productId);
        if (!product) {
          console.warn(`Produit ${item.productId} introuvable — ignoré`);
          continue;
        }
        let paired: Member | undefined;
        if (item.pairedMemberId) {
          paired = this.members.find(m => m.id === item.pairedMemberId);
        }
        const cartItem = this.cartService.build_cart_item(product, buyer, paired);
        this.cartService.addToCart(cartItem);
      }

      // Recalculer dette/avoir depuis les écritures comptables
      const buyerName = buyer.lastname + ' ' + buyer.firstname;
      const debt = this.bookService.find_member_debt(buyerName);
      if (debt > 0) this.cartService.setDebt(buyerName, debt);
      const asset = this.bookService.find_assets(buyerName);
      if (asset > 0) this.cartService.setAsset(buyerName, asset);

      // Tag Stripe pour traçabilité et détection de doublon
      this.cartService.setStripeTag(getShortStripeTag(tx.stripeSessionId));

      // Session comptable : utiliser les données du paiement original
      const session = {
        season: tx.stripeMeta.season || this.systemDataService.get_season(new Date()),
        date: tx.stripeMeta.date || new Date().toISOString().split('T')[0],
      };

      // Mode de paiement = virement (Stripe)
      this.cartService.payment = {
        mode: PaymentMode.TRANSFER,
        amount: this.cartService.getCartAmount(),
        payer_id: buyer.id,
        bank: '',
        cheque_no: '',
      };

      // Créer le BookEntry + GameCard via save_sale
      await this.cartService.save_sale(session, buyer);

      // Marquer comme traitée dans StripeTransaction
      await this.markProcessed(tx);

      this.toastService.showSuccess('Réconciliation',
        `Vente ${buyerName} enregistrée (${this.formatAmount(tx.amountCents)})`);

      // Retirer de la liste
      this.pending = this.pending.filter(p => p.id !== tx.id);

    } catch (error) {
      console.error('Erreur traitement transaction:', tx.id, error);
      this.toastService.showErrorToast('Réconciliation',
        `Erreur lors du traitement de la vente pour ${tx.buyerName}`);
    } finally {
      this.processing.delete(tx.id);
    }
  }

  async processAll(): Promise<void> {
    for (const tx of [...this.pending]) {
      await this.processTransaction(tx);
    }
  }

  private async markProcessed(tx: PendingTransaction): Promise<void> {
    try {
      await this.dbHandler.markStripeTransactionProcessed(tx.id);
    } catch (error) {
      console.error('Erreur marquage transaction:', tx.id, error);
    }
  }
}
