import { Injectable } from '@angular/core';
import { Session, Expense, Revenue } from '../../../common/interfaces/accounting.interface';
import { SystemDataService } from '../../../common/services/system-data.service';
import { GroupService } from '../../../common/authentification/group.service';
import { BookService } from '../../services/book.service';

export interface ShopInitState {
  session: Session;
  operations: (Revenue | Expense)[];
  canEditPrice: boolean;
}

/**
 * ShopInitializationService
 * Gère l'initialisation de la boutique: session, permissiosn, opérations
 */
@Injectable({
  providedIn: 'root'
})
export class ShopInitializationService {

  constructor(
    private systemDataService: SystemDataService,
    private groupService: GroupService,
    private bookService: BookService,
  ) {}

  /**
   * Initialise la session (date, saison)
   */
  initializeSession(): Session {
    const today = new Date();
    return {
      date: today.toISOString().split('T')[0],
      season: this.systemDataService.get_season(today),
    };
  }

  /**
   * Charge les opérations du journal
   */
  async loadOperations(): Promise<(Revenue | Expense)[]> {
    return new Promise((resolve) => {
      this.bookService.list_book_entries().subscribe(() => {
        resolve(this.bookService.get_operations());
      });
    });
  }

  /**
   * Détermine les permissions du caissier
   * Niveau 2+ (Editor, Admin, System) peut éditer les prix
   */
  async determinePermissions(): Promise<{ canEditPrice: boolean }> {
    try {
      const accreditation = await this.groupService.getUserAccreditation();
      return {
        canEditPrice: accreditation.level >= 2,
      };
    } catch {
      return { canEditPrice: false };
    }
  }

  /**
   * Initialisation complète
   */
  async initializeShop(): Promise<ShopInitState> {
    const session = this.initializeSession();
    const operations = await this.loadOperations();
    const permissions = await this.determinePermissions();

    return {
      session,
      operations,
      canEditPrice: permissions.canEditPrice,
    };
  }
}
