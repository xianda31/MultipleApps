import { Injectable } from '@angular/core';
import { Member } from '../../../common/interfaces/member.interface';
import { CartService } from '../cart/cart.service';
import { BookService } from '../../services/book.service';
import { MembersService } from '../../../common/services/members.service';
import { ToastService } from '../../../common/services/toast.service';
import { DBhandler } from '../../../common/services/graphQL.service';
import { firstValueFrom, timeout } from 'rxjs';

export interface BuyerState {
  buyer: Member | null;
  debtAmount: number;
  assetAmount: number;
  message: string;
}

/**
 * BuyerContextService
 * Gère complètement le contexte de l'acheteur
 */
@Injectable({
  providedIn: 'root'
})
export class BuyerContextService {
  private setupRevision = 0;

  constructor(
    private cartService: CartService,
    private bookService: BookService,
    private membersService: MembersService,
    private toastService: ToastService,
    private dbHandler: DBhandler,
  ) {}

  /**
   * Trouve un acheteur par ID
   */
  findBuyerById(buyerId: string, members: Member[]): Member | undefined {
    return members.find(m => m.id === buyerId);
  }

  /**
   * Valide qu'un acheteur a un profil valide
   */
  isValidBuyer(member: Member | null): boolean {
    if (!member) return false;
    return this.membersService.canPurchase(member)
      && !!(member.firstname || member.lastname || member.license_number);
  }

  /**
   * Charge la dette d'un acheteur
   */
  async loadDebt(buyer: Member): Promise<number> {
    const name = buyer.lastname + ' ' + buyer.firstname;
    return this.bookService.find_member_debt(name);
  }

  /**
   * Charge les avoirs d'un acheteur
   */
  async loadAssets(buyer: Member): Promise<number> {
    const name = buyer.lastname + ' ' + buyer.firstname;
    return this.bookService.find_assets(name);
  }

  async loadBalance(buyer: Member, refresh = false): Promise<BuyerState> {
    await this.bookService.whenBookEntriesLoaded();
    if (!this.bookService.is_book_entries_loaded()) {
      throw new Error('La synchronisation comptable est indisponible.');
    }
    const entries = refresh
      ? await firstValueFrom(this.dbHandler.listBookEntries(this.bookService.season).pipe(timeout(15000)))
      : undefined;
    const name = `${buyer.lastname} ${buyer.firstname}`;
    return {
      buyer,
      debtAmount: Math.max(0, this.bookService.find_member_debt(name, entries)),
      assetAmount: Math.max(0, this.bookService.find_assets(name, entries)),
      message: '',
    };
  }

  /**
   * Détermine le message de license/adhésion
   */
  determineLicenseMessage(
    licensePaid: boolean,
    membershipPaid: boolean
  ): string {
    if (!licensePaid && !membershipPaid) {
      return 'Adhésion et licence à prendre';
    } else if (!licensePaid) {
      return 'Licence à prendre';
    } else if (!membershipPaid) {
      return 'Adhésion à prendre';
    }
    return '';
  }

  /**
   * Configure le contexte de l'acheteur dans le panier
   */
  async setupBuyer(buyer: Member | null): Promise<BuyerState> {
    const revision = ++this.setupRevision;
    if (!buyer) {
      this.cartService.clearCart();
      return {
        buyer: null,
        debtAmount: 0,
        assetAmount: 0,
        message: '',
      };
    }

    // Mise à jour du panier
    const buyerName = buyer.lastname + ' ' + buyer.firstname;
    this.cartService.clearCart();
    this.cartService.setBuyer(buyerName);

    // Chargement des données
    const state = await this.loadBalance(buyer);
    const { debtAmount, assetAmount } = state;
    if (revision !== this.setupRevision) return state;

    // Configuration du panier
    if (debtAmount > 0) {
      this.toastService.showWarning(
        'dette',
        `cette personne a une dette de ${debtAmount.toFixed(2)} €`
      );
      this.cartService.setDebt(buyerName, debtAmount);
    }

    if (assetAmount > 0) {
      this.cartService.setAsset(buyerName, assetAmount);
    }

    return {
      buyer,
      debtAmount,
      assetAmount,
      message: '', // Message = licence/adhésion calculé dans le composant
    };
  }
}
