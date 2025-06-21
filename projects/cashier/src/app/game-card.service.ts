import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable, switchMap } from 'rxjs';
import { GameCard, MAX_STAMPS, PlayBook_input } from './game-cards/game-card.interface';
import { Member } from '../../../common/member.interface';
import { MembersService } from '../../../admin-dashboard/src/app/members/service/members.service';
import { ToastService } from '../../../common/toaster/toast.service';
import { DBhandler } from './graphQL.service';


@Injectable({
  providedIn: 'root'
})
export class GameCardService {

  private members: Member[] = [];
  private _gameCards!: GameCard[];
  private gameCards$: BehaviorSubject<GameCard[]> = new BehaviorSubject<GameCard[]>(this._gameCards);

  constructor(
    private membersService: MembersService,
    private toastService: ToastService,
    private dbHandler: DBhandler
  ) { }

  // interfaces haut niveau



  check_solvencies(members: Member[]): Observable<Map<string, number>> {
    let solvencies = new Map<string, number>()
    let card_set = new Set<GameCard>([]);

    const share = (card: GameCard, member: Member, members: Member[]): number => {
      let count = card.owners.reduce((acc, owner) => acc += members.find(m => m.id === owner.id) ? 1 : 0, 0);
      if (count === 0) { throw new Error('algorithm failure !!!'); }
      return count;
    }

    const member_credit = (member: Member): number => {
      return Array.from(card_set)
        .filter(card => card.owners.some(owner => owner.license_number === member.license_number))
        .reduce((total, card) => total + (card.initial_qty - card.stamps.length) / share(card, member, members), 0);
    };

    return this.gameCards$.pipe(
      map((cards) => {
        card_set.clear();
        // recherche des cartes de membres
        members.forEach(member => {
          const memberCards = cards.filter(card => card.owners.some(owner => owner.license_number === member.license_number));
          if (memberCards.length > 0) { memberCards.forEach(card => card_set.add(card)) }
        })

        // calcul du solde de chaque membre

        members.forEach(member => {
          const credit = member_credit(member);
          solvencies.set(member.license_number, credit);
        });

        return solvencies;
      })
    );
  }


  get_member_credit(member: Member): number {
    return this._gameCards
      .filter(c => c.owners.some(owner => owner.license_number === member.license_number))
      .reduce((total, card) => total + (card.initial_qty - card.stamps.length), 0);
  }

  stamp_member_card(member: Member, stamp_date: string, double:boolean): void {
    const card = this._gameCards.find(c => c.owners.some(owner => (owner.license_number === member.license_number) && (c.stamps.length < c.initial_qty)));
    if (card) {
      card.stamps.push(stamp_date);
      if( double) {
        card.stamps.push(stamp_date); // add a second stamp if double
      }
      this.updateCard(card).catch(error => {
        console.error('Error stamping member card:', error);
      });
    }
  }

  //  interfaces editeur

  get gameCards(): Observable<GameCard[]> {
    return this._gameCards ? this.gameCards$.asObservable() : this.listCards().pipe(
      switchMap(() => this.gameCards$.asObservable()));
  }

  async createCard(owners: Member[], qty?: number): Promise<GameCard> {
    const card_input: PlayBook_input = {
      licenses: owners.map((member) => member.license_number),
      initial_qty: qty ?? MAX_STAMPS,
      stamps: []
    };
    try {
      const createdPlayBook = await this.dbHandler.createPlayBook(card_input);
      const new_card: GameCard = {
        id: createdPlayBook.id,
        owners: owners,
        initial_qty: createdPlayBook.initial_qty,
        stamps: createdPlayBook.stamps.filter((stamp): stamp is string => stamp !== null),
        licenses: createdPlayBook.licenses,
        createdAt: createdPlayBook.createdAt,
      };
      if (this._gameCards) {   // cache update if exists
        this._gameCards.push(new_card);
        this.gameCards$.next(this._gameCards);
              let ownersNames = new_card.owners.map(owner => `${owner.firstname} ${owner.lastname}`).join(', ');

        this.toastService.showSuccessToast('Gestion des cartes', 'Carte de ' + ownersNames + ' créée');
      }
      return new_card;
    } catch (errors) {
      if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
        if ((errors[0] as any).errorType === 'Unauthorized') {
          this.toastService.showErrorToast('Gestion des cartes', 'Vous n\'êtes pas autorisé à créer une carte de tournoi');
          return Promise.reject('Unauthorized');
        }
      }

      this.toastService.showErrorToast('Gestion des cartes', 'Une erreur est survenue lors de la modifier de la carte de tournoi');
      return Promise.reject('Error updating game card');
    }
  }

  async updateCard(card: GameCard): Promise<GameCard> {
    try {
      const { owners, ...playBook } = card; // Destructure to remove owners
      const updatedBook = await this.dbHandler.updatePlayBook(playBook);
      const updatedGameCard: GameCard = {
        id: updatedBook.id,
        licenses: updatedBook.licenses.filter((license): license is string => license !== null),
        stamps: updatedBook.stamps.filter((stamp): stamp is string => stamp !== null),
        owners: card.owners,
        initial_qty: updatedBook.initial_qty,
      };
      this._gameCards = this._gameCards.filter(c => c.id !== card.id);
      this._gameCards.push(updatedGameCard);
      this._gameCards.sort((a, b) => a.owners[0].lastname.localeCompare(b.owners[0].lastname));

      this.gameCards$.next(this._gameCards);
      let ownersNames = updatedGameCard.owners.map(owner => `${owner.firstname} ${owner.lastname}`).join(', ');
      this.toastService.showSuccessToast('Gestion des cartes', 'Carte de ' + ownersNames + ' mise à jour');
      return updatedGameCard;

    } catch (errors) {
      if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
        if ((errors[0] as any).errorType === 'Unauthorized') {
          this.toastService.showErrorToast('Gestion des cartes', 'Vous n\'êtes pas autorisé à modifier une carte de tournoi');
          return Promise.reject('Unauthorized');
        }
      }
      this.toastService.showErrorToast('Gestion des cartes', 'Une erreur est survenue lors de la modification de la carte de tournoi');
      return Promise.reject('Error updating game card');
    }
  }

  async deleteCard(card: GameCard): Promise<boolean> {
    try {
      const done = await this.dbHandler.deletePlayBook(card);
      if (done) {
        this._gameCards = this._gameCards.filter(c => c.id !== card.id);
        this.gameCards$.next(this._gameCards);
              let ownersNames = card.owners.map(owner => `${owner.firstname} ${owner.lastname}`).join(', ');

        this.toastService.showSuccessToast('Gestion des cartes', 'La carte de '+ ownersNames + ' a été supprimée');
        this.toastService.showInfoToast('Gestion des cartes', 'Supprimez la recette associée si nécessaire');
        return true;
      }
      return false;
    } catch (error) {
      this.toastService.showErrorToast('Gestion des cartes', 'La suppression de la carte de tournoi a échoué');
      console.error('Error deleting game card:', error);
      throw error;
    }
  }

  listCards(): Observable<GameCard[]> {
    return this.membersService.listMembers().pipe(
      map((members) => {
        this.members = members;
      }),
      switchMap(() => this.dbHandler.listPlayBooks()),
      map((cards) => {
        this._gameCards = cards.map(card => {
          const owners = card.licenses
            .filter((license): license is string => license !== null)
            .map((license) => this.members.find(member => member.license_number === license))
            .filter((owner): owner is Member => owner !== undefined);
          return {
            id: card.id,
            owners: owners,
            initial_qty: card.initial_qty,
            stamps: (card.stamps ?? []).filter((stamp): stamp is string => stamp !== null),
            licenses: card.licenses.filter((license): license is string => license !== null),
            createdAt: card.createdAt,
            updatedAt: card.updatedAt
          };
        });

        this._gameCards.sort((a, b) => a.owners[0].lastname.localeCompare(b.owners[0].lastname));

        this.gameCards$.next(this._gameCards);
        return this._gameCards;
      }),
    );
  }

}
