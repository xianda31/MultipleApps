import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { Member } from '../../../../../common/member.interface';
import { Observable } from 'rxjs';
import { InputMemberComponent } from '../../input-member/input-member.component';
import { MAX_STAMPS } from '../game-card.interface';
import { MembersService } from '../../../../../common/members/services/members.service';
@Component({
    selector: 'app-get-game-cards-owners',
    imports: [CommonModule, FormsModule, ReactiveFormsModule, InputMemberComponent],
    templateUrl: './get-game-cards-owners.component.html',
    styleUrl: './get-game-cards-owners.component.scss'
})
export class GetGameCardsOwnersComponent {
  ownersForm!: FormGroup;
  members: Member[] = [];
  max_stamps : number = MAX_STAMPS;
constructor(
    private activeModal: NgbActiveModal,
    private formbuilder: FormBuilder,
    private membersService: MembersService,
    
  ) {

    // this.members$ = this.membersService.listMembers();
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
      // console.log('GetGameCardsOwnersComponent.members', this.members);
    });

    this.ownersForm = this.formbuilder.group({
      quantity: [MAX_STAMPS, [Validators.required, Validators.min(1), Validators.max(MAX_STAMPS)]],
      owner1: [null, Validators.required],
      owner2: [null],
    });
  }

  
  get owner1() { return this.ownersForm.get('owner1')!; }
  get owner2() { return this.ownersForm.get('owner2')!; }

  create() {
    let response: { owners: Member[], qty: number } = {
      owners: [],
      qty: this.ownersForm.value.quantity
    };
    if (this.ownersForm.value.owner1) {
      response.owners.push(this.ownersForm.value.owner1);
    }
    if (this.ownersForm.value.owner2) {
      response.owners.push(this.ownersForm.value.owner2);
    }
    this.activeModal.close(response);
  }
  close() {
    this.activeModal.close(null);
  }

}
