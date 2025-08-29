import { Component, OnInit } from '@angular/core';
import { GameCardService } from '../../services/game-card.service';
import { CommonModule } from '@angular/common';
import { GameCard } from '../game-card.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetGameCardsOwnersComponent } from '../get-game-cards-owners/get-game-cards-owners.component';
import { Member } from '../../../common/interfaces/member.interface';
import { EditGameCardComponent } from '../edit-game-card/edit-game-card.component';
import { GetConfirmationComponent } from '../../modals/get-confirmation/get-confirmation.component';
import { GcardsExcelExportService } from '../gcards-excel-export.service';

@Component({
    selector: 'app-game-cards-editor',
    imports: [CommonModule],
    templateUrl: './game-cards-editor.component.html',
    styleUrl: './game-cards-editor.component.scss'
})
export class GameCardsEditorComponent implements OnInit {

  cards: GameCard[] = [];
  total_asset: number = 0;
  total_null_cards: number = 0;
  loaded: boolean = false;

  constructor(
    private gameCardService: GameCardService,
    private modalService: NgbModal,
    private exportService : GcardsExcelExportService 
  ) { }


  ngOnInit(): void {

    this.gameCardService.gameCards.subscribe(cards => {
      this.cards = cards.sort((a, b) => {
        return a.owners[0].lastname.localeCompare(b.owners[0].lastname);
      });
      this.total_asset = cards.reduce((acc, card) => acc + card.initial_qty-card.stamps.length, 0);
      this.total_null_cards = cards.reduce((acc, card) => acc + ((card.initial_qty-card.stamps.length) === 0 ? 1 : 0), 0);
      this.loaded = true;
    });
  }

stamps_number(card: GameCard): number {
   return  card.stamps.length;
}

  createGameCard() {
    const modalRef = this.modalService.open(GetGameCardsOwnersComponent, { centered: true });
    modalRef.result.then((response: { owners:Member[],qty:number}) => {
      if (response) {
        const owners: Member[] = response.owners;
        const qty: number = response.qty;

        this.gameCardService.createCard(owners,qty);
      }
    });
  }

  updateGameCard(card: GameCard) {
    this.gameCardService.updateCard(card)
  }

  deleteGameCard(card: GameCard, event?: Event) {
    const opener = event?.target as HTMLElement;
    
    const modalRef = this.modalService.open(GetConfirmationComponent, { centered: true });
    const owners = card.owners.reduce((acc, owner) => acc + owner.firstname + ' ' + owner.lastname.toUpperCase() + ' ', '');
    modalRef.componentInstance.title = `Suppression d'une carte d'admission `;
    modalRef.componentInstance.subtitle = `détenteur(s) :${owners} `;
    modalRef.result.then((answer: boolean) => {
      if (answer) {
        this.gameCardService.deleteCard(card);
      }
      // Restore focus to the opener button
      opener?.focus();
    });
  }


  editGameCard(card: GameCard) {
    const modalRef = this.modalService.open(EditGameCardComponent, { centered: true });
    modalRef.componentInstance.card = card;
    modalRef.result.then((new_card: GameCard) => {
      if (new_card) {
        console.log('GameCardsEditorComponent.editGameCard', new_card);
        this.updateGameCard(new_card);
        if (new_card.stamps.length === 0) {
          this.total_null_cards++;
        }
      }
    });
  }

  exportToExcel() {
    this.exportService.exportGameCardsToExcel(this.cards);
  }

  deleteNulls() {
    const modalRef = this.modalService.open(GetConfirmationComponent, { centered: true });
    modalRef.componentInstance.title = `Suppression de toutes les cartes terminées`;
    modalRef.componentInstance.subtitle = `Êtes-vous sûr de vouloir effacer cette historique`;
    modalRef.result.then((answer: boolean) => {
      if (answer) {
        this.gameCardService.deleteNullCards();
      }
    });
  }

}
