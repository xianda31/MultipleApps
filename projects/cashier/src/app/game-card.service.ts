import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
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

  
  //  interfaces editeur
  
  get gameCards(): Observable<GameCard[]> {
    return this._gameCards ? this.gameCards$.asObservable() : this.listCards().pipe(
      switchMap(() => this.gameCards$.asObservable()));
  }

  async createCard(owners: Member[]): Promise<GameCard> {
    const input_card: Omit<TwelveGameCard, 'id' | 'createdAt' | 'updatedAt'> = {
      licenses: owners.map((member) => member.license_number),
      initial_qty: MAX_STAMPS,
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

      this._gameCards.push(new_card);
      this.gameCards$.next(this._gameCards);
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
        createdAt:  '',
        updatedAt: ''
      };

      const updatedCard = await this.updateTwelveGameCard(updatedCardData);
      const updatedGameCard: GameCard = {
        id: updatedCard.id,
        owners: card.owners,
        initial_qty: updatedCard.initial_qty,
        stamps: updatedCard.stamps.filter((stamp): stamp is string => stamp !== null),
        createdAt: updatedCard.createdAt,
        updatedAt: updatedCard.updatedAt
      };

      const index = this._gameCards.findIndex(c => c.id === card.id);
      if (index !== -1) {
        this._gameCards[index] = updatedGameCard;
      }
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
        console.log('GameCardService.deleteCard', card.id, 'deleted', this._gameCards.length, 'cards remaining');
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
        console.log('%s members loaded', this.members.length);
      }),
      switchMap(() => this.listTwelveGameCards()),
      map((cards) => {
        this._gameCards = cards.map(card => {
          const owners = card.licenses
            .map((license) => this.members.find(member => member.license_number === license))
            .filter((owner): owner is Member => owner !== undefined);
          return {
            id: card.id,
            owners : owners,
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
