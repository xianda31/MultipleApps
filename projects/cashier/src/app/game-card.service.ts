import { Injectable } from '@angular/core';
import { generateClient, get } from 'aws-amplify/api';
import { Schema } from '../../../../amplify/data/resource';
import { BehaviorSubject, from, map, Observable, switchMap } from 'rxjs';
import { GameCard, MAX_STAMPS } from './game-cards/game-card.interface';
import { Member } from '../../../common/member.interface';
import { MembersService } from '../../../admin-dashboard/src/app/members/service/members.service';
import { ToastService } from '../../../common/toaster/toast.service';

type TwelveGameCard = Schema['TwelveGameCard']['type'];

@Injectable({
  providedIn: 'root'
})
export class GameCardService {

  private members: Member[] = [];
  private _gameCards!: GameCard[];
  private gameCards$: BehaviorSubject<GameCard[]> = new BehaviorSubject<GameCard[]>(this._gameCards);

  constructor(
    private membersService: MembersService,
    private toastService: ToastService
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
        .reduce((total, card) => total + (card.initial_qty - card.stamps.length)/share(card,member,members), 0);
    };

    return this.gameCards$.pipe(
      map((cards) => {
        card_set.clear();
        // recherche des cartes de membres
        members.forEach(member => {
          const memberCards = cards.filter(card => card.owners.some(owner => owner.license_number === member.license_number));
          if (memberCards.length > 0) {             memberCards.forEach(card => card_set.add(card))            }
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

  stamp_member_card(member: Member, stamp_date: string): void {
    const card = this._gameCards.find(c => c.owners.some(owner => (owner.license_number === member.license_number) && (c.stamps.length < c.initial_qty)));
    if (card) {
      card.stamps.push(stamp_date);
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

  async createCard(owners: Member[], qty ?:number): Promise<GameCard> {
    const input_card: Omit<TwelveGameCard, 'id' | 'createdAt' | 'updatedAt'> = {
      licenses: owners.map((member) => member.license_number),
      initial_qty: qty ?? MAX_STAMPS,
      stamps: [],
    };
    try {
      const createdCard = await this.createTwelveGameCard(input_card);
      const new_card: GameCard = {
        id: createdCard.id,
        owners: owners,
        initial_qty: createdCard.initial_qty,
        stamps: createdCard.stamps.filter((stamp): stamp is string => stamp !== null),
        createdAt: createdCard.createdAt,
        updatedAt: createdCard.updatedAt
      };
      if(this._gameCards) {   // cache update if exists
      this._gameCards.push(new_card);
      this.gameCards$.next(this._gameCards);
      }
      return new_card;
    } catch (error) {
      console.error('Error creating game card:', error);
      throw error;
    }
  }

  async updateCard(card: GameCard): Promise<GameCard> {
    try {
      const updatedCardData: TwelveGameCard = {
        id: card.id,
        licenses: card.owners.map((owner) => owner.license_number),
        initial_qty: card.initial_qty,
        stamps: card.stamps,
        createdAt: '',
        updatedAt: ''
      };

      const updatedCard = await this.updateTwelveGameCard(updatedCardData);
      if (!updatedCard) {
        throw new Error('Failed to update game card');
      }
      const updatedGameCard: GameCard = {
        id: updatedCard.id,
        owners: card.owners,
        initial_qty: updatedCard.initial_qty,
        stamps: updatedCard.stamps.filter((stamp): stamp is string => stamp !== null),
        createdAt: updatedCard.createdAt,
        updatedAt: updatedCard.updatedAt
      };
      this._gameCards = this._gameCards.filter(c => c.id !== card.id);
      this._gameCards.push(updatedGameCard);
      this._gameCards.sort((a, b) => a.owners[0].lastname.localeCompare(b.owners[0].lastname));
      
      this.gameCards$.next(this._gameCards);
      return updatedGameCard;
    } catch (error) {
      this.toastService.showErrorToast('Gestion des cartes', 'La mise à jour de la carte de tournoi a échoué');
      console.error('Error updating game card:', error);
      throw error;
    }
  }

  async deleteCard(card: GameCard): Promise<boolean> {
    try {
      const done = await this.deleteTwelveGameCard(card.id);
      if (done) {
        this._gameCards = this._gameCards.filter(c => c.id !== card.id);
        this.gameCards$.next(this._gameCards);
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
      switchMap(() => this.listTwelveGameCards()),
      map((cards) => {
        this._gameCards = cards.map(card => {
          const owners = card.licenses
            .map((license) => this.members.find(member => member.license_number === license))
            .filter((owner): owner is Member => owner !== undefined);
          return {
            id: card.id,
            owners: owners,
            initial_qty: card.initial_qty,
            stamps: (card.stamps ?? []).filter((stamp): stamp is string => stamp !== null),
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



  // AWS handlers

  // CREATE
  async createTwelveGameCard(card: Omit<TwelveGameCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<TwelveGameCard> {
    const client = generateClient<Schema>();
    const { data, errors } = await client.models.TwelveGameCard.create(card, { authMode: 'identityPool' });
    if (errors) throw errors;
    return data as TwelveGameCard;
  }

  // READ (single)
  async getTwelveGameCard(id: string): Promise<TwelveGameCard | null> {
    const client = generateClient<Schema>();
    const { data, errors } = await client.models.TwelveGameCard.get({ id });
    if (errors) throw errors;
    return data as TwelveGameCard;
  }

  // UPDATE
  async updateTwelveGameCard(card: TwelveGameCard): Promise<TwelveGameCard> {
    const client = generateClient<Schema>();
    const { data, errors } = await client.models.TwelveGameCard.update(card);
    if (errors) throw errors;
    return data as TwelveGameCard;
  }

  // DELETE
  async deleteTwelveGameCard(id: string): Promise<boolean> {
    const client = generateClient<Schema>();
    const { errors } = await client.models.TwelveGameCard.delete({ id });
    if (errors) throw errors;
    return true;
  }

  // LIST (all)
  listTwelveGameCards(): Observable<TwelveGameCard[]> {
    const client = generateClient<Schema>();
    return from(
      client.models.TwelveGameCard.list({ authMode: 'identityPool' })
        .then(({ data, errors }) => {
          if (errors) throw errors;
          return data as TwelveGameCard[];
        })
    );
  }
}
