import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MembersService } from '../../../../../web-back/src/app/members/service/members.service';
import { GameCard, MAX_STAMPS } from '../game-card.interface';
import { CommonModule } from '@angular/common';

interface Stamp_place {
  free : boolean;
  stamp?: string;
} 

@Component({
    selector: 'app-edit-game-card',
    imports: [CommonModule],
    templateUrl: './edit-game-card.component.html',
    styleUrl: './edit-game-card.component.scss'
})
export class EditGameCardComponent implements OnInit {
  @Input() card!: GameCard;
  stamp_places !: Stamp_place[];
  free_places_nbr !: number;
  stamped : boolean = false;

  constructor(
    private activeModal: NgbActiveModal,
  ) {
  }

  ngOnInit(): void {
    // Initialize the stamp places based on the card's stamps
    this.initialize_stamp_places();
  }

  initialize_stamp_places() {
    this.stamp_places = Array.from({ length: this.card.initial_qty }, (_, index) => {
      const stamp = this.card.stamps[index];
      return {
        free: !stamp,
        stamp: stamp ?? 'n°' + `${index + 1}`
      };
    });
    this.free_places_nbr = this.stamp_places.reduce((acc, place) => acc + (place.free ? 1 : 0), 0);
  }

  updated_card() : GameCard {
    let new_card = { ...this.card }
    // Update the card with the current stamp places
    new_card.stamps = [];
    this.stamp_places.map(place => {
      if (!place.free) { new_card.stamps.push(place.stamp!) };
    });
    return new_card;
  }

  stamp(index : number) {
    if(this.stamp_places[index].free) {
      const today = new Date().toLocaleDateString();
      this.stamp_places[index] = {stamp : today, free:false};
      this.free_places_nbr--; 
      this.stamped = true;
    }
  }


  got_it() {
    if(this.stamped) {
    this.activeModal.close(this.updated_card());
    } else {
      this.activeModal.close(null);
    }
  }
}
