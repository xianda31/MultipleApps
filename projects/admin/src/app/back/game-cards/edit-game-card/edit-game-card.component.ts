import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { GameCard } from '../game-card.interface';
import { CommonModule } from '@angular/common';
import { MembersService } from '../../../common/services/members.service';
import { Member } from '../../../common/interfaces/member.interface';

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
  changed : boolean = false;
  members: Member[] = [];
  selectedOwnerLicense = '';

  private normalizeLicense(value: string | null | undefined): string {
    return (value ?? '').trim();
  }

  constructor(
    private activeModal: NgbActiveModal,
    private membersService: MembersService,
  ) {
  }

  ngOnInit(): void {
    // Initialize the stamp places based on the card's stamps
    this.initialize_stamp_places();

    this.membersService.listMembers().subscribe(members => {
      this.members = members;
    });
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
    new_card.licenses = new_card.owners.map(owner => owner.license_number);
    return new_card;
  }

  stamp(index : number) {
    if(this.stamp_places[index].free) {
      const today = new Date().toLocaleDateString();
      this.stamp_places[index] = {stamp : today, free:false};
      this.free_places_nbr--; 
      this.changed = true;
    }else {
      this.stamp_places[index] = {stamp : 'restitué', free:true};
      this.free_places_nbr++;
      this.changed = true;
    }
  }

  ownerCandidates(): Member[] {
    if (!this.card || this.card.owners.length >= 2) {
      return [];
    }
    const currentLicenses = new Set(this.card.owners.map(owner => this.normalizeLicense(owner.license_number)));
    return this.members.filter(member => !currentLicenses.has(this.normalizeLicense(member.license_number)));
  }

  canRemoveOwner(): boolean {
    return !!this.card && this.card.owners.length > 1;
  }

  addOwner(): void {
    const selectedLicense = this.normalizeLicense(this.selectedOwnerLicense);
    if (!selectedLicense || !this.card || this.card.owners.length >= 2) {
      return;
    }

    const selectedMember = this.members.find(
      member => this.normalizeLicense(member.license_number) === selectedLicense
    );
    if (!selectedMember) {
      return;
    }

    this.card = {
      ...this.card,
      owners: [...this.card.owners, selectedMember],
    };
    this.selectedOwnerLicense = '';
    this.changed = true;
  }

  removeOwner(ownerLicense: string): void {
    if (!this.card || this.card.owners.length <= 1) {
      return;
    }

    this.card = {
      ...this.card,
      owners: this.card.owners.filter(owner => owner.license_number !== ownerLicense),
    };
    this.changed = true;
  }


  got_it() {
    // If an owner is selected but not explicitly added yet, apply it on validation.
    if (this.selectedOwnerLicense && this.card.owners.length < 2) {
      this.addOwner();
    }

    if(this.changed) {
    this.activeModal.close(this.updated_card());
    } else {
      this.activeModal.close(null);
    }
  }

  close() {
    this.activeModal.close(null);
  }
}
