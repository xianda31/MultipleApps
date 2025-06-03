import { Component, OnInit } from '@angular/core';
import { GameCardService } from '../../game-card.service';
import { CommonModule } from '@angular/common';
import { GameCard, MAX_STAMPS } from '../game-card.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetGameCardsOwnersComponent } from '../get-game-cards-owners/get-game-cards-owners.component';
import { Member } from '../../../../../common/member.interface';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { switchMap, tap } from 'rxjs';
import { EditGameCardComponent } from '../edit-game-card/edit-game-card.component';

@Component({
  selector: 'app-game-cards-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-cards-editor.component.html',
  styleUrl: './game-cards-editor.component.scss'
})
export class GameCardsEditorComponent implements OnInit {

  cards: GameCard[] = [];

  constructor(
    private gameCardService: GameCardService,
    private modalService: NgbModal,
  ) { }


  ngOnInit(): void {

    this.gameCardService.gameCards.subscribe(cards => {
      this.cards = cards;
    });
  }

stamps_number(card: GameCard): number {
   return  card.stamps.length;
}

  createGameCard() {
    const modalRef = this.modalService.open(GetGameCardsOwnersComponent, { centered: true });
    modalRef.result.then((response: Member[]) => {
      if (response) {
        const owners: Member[] = response;

        this.gameCardService.createCard(owners);
      }
    });
  }

  // Example method to update an existing game card
  updateGameCard(card: GameCard) {
    this.gameCardService.updateCard(card)
  }

  deleteGameCard(card: GameCard) {
    this.gameCardService.deleteCard(card)
  }


  editGameCard(card: GameCard) {
    const modalRef = this.modalService.open(EditGameCardComponent, { centered: true });
    modalRef.componentInstance.card = card;
    modalRef.result.then((new_card: GameCard) => {
      if (new_card) {
        console.log('GameCardsEditorComponent.editGameCard', new_card);
        this.updateGameCard(new_card);
      }
    });
  }

}
