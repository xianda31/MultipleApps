import { Component } from '@angular/core';
import { GameCard } from '../../back/game-cards/game-card.interface';
import { GameCardService } from '../../back/services/game-card.service';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { MembersService } from '../../common/members/services/members.service';
import { map, Observable, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { TitleService } from '../title.service';

interface Extended_GameCard extends GameCard {
  free_places_nbr: number;
  stamp_places: { free: boolean; stamp?: string }[];
}

@Component({
  selector: 'app-game-cards-owned',
  imports: [CommonModule],
  templateUrl: './game-cards-owned.component.html',
  styleUrl: './game-cards-owned.component.scss'
})
export class GameCardsOwnedComponent {
  // cards: GameCard[] = [];
  cards$!: Observable<Extended_GameCard[]>;

  constructor(
    private gameCardService: GameCardService,
    private auth: AuthentificationService,
    private memberService: MembersService,
    private titleService: TitleService
  ) { }

  ngOnInit(): void {

    this.titleService.setTitle('Droits de table');

    this.cards$ = this.auth.logged_member$.pipe(
      map(member => {
        let full_name = member ? this.memberService.full_name(member) : '';
        return full_name;
      }),
      switchMap((full_name) =>
        this.gameCardService.gameCards.pipe(
          map(cards => {
            cards = cards
              .filter(card => card.owners.some(owner => this.memberService.full_name(owner) === full_name));
            if (!cards || cards.length === 0) {
              return [];
            }
            let extended_cards: Extended_GameCard[] = cards.map(card => {
              const { free_places_nbr, stamp_places } = this.initialize_stamp_places(card);
              return { ...card, free_places_nbr, stamp_places };
            });
            extended_cards = extended_cards.filter(card => card.free_places_nbr > 0);
            if (!extended_cards || extended_cards.length === 0) {
              return [];
            }
            return extended_cards.sort((a, b) => { return a.free_places_nbr - b.free_places_nbr; });

          })

        )
      )
    );
  }

  total_free_places(cards: Extended_GameCard[]): number {
    return cards.reduce((total, card) => total + card.free_places_nbr, 0);
  }

  initialize_stamp_places(card: GameCard): { free_places_nbr: number; stamp_places: { free: boolean; stamp?: string }[]; } {
    const stamp_places = Array.from({ length: card.initial_qty }, (_, index) => {
      const stamp = card.stamps[index];
      return {
        free: !stamp,
        stamp: stamp ?? 'n°' + `${index + 1}`
      };
    });
    const free_places_nbr = stamp_places.reduce((acc, place) => acc + (place.free ? 1 : 0), 0);
    return { free_places_nbr, stamp_places };
  }
}
