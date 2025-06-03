import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { CommonModule } from '@angular/common';
import { Member } from '../../../../../common/member.interface';
import { Observable } from 'rxjs';
import { InputMemberComponent } from '../../input-member/input-member.component';
@Component({
  selector: 'app-get-game-cards-owners',
  standalone: true,
  imports: [CommonModule,FormsModule,ReactiveFormsModule,InputMemberComponent],
  templateUrl: './get-game-cards-owners.component.html',
  styleUrl: './get-game-cards-owners.component.scss'
})
export class GetGameCardsOwnersComponent {
  ownersForm!: FormGroup;
  // members$ !: Observable<Member[]>;
  members: Member[] = [];
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
      owner1: [null, Validators.required],
      owner2: [null],
    });
  }

  
  get owner1() { return this.ownersForm.get('owner1')!; }
  get owner2() { return this.ownersForm.get('owner2')!; }

  got_it() {
    const owners: Member[] = [];
    if (this.ownersForm.value.owner1) {
      owners.push(this.ownersForm.value.owner1);
    }
    if (this.ownersForm.value.owner2) {
      owners.push(this.ownersForm.value.owner2);
    }
    this.activeModal.close(owners);
  }
  close() {
    this.activeModal.close(null);
  }

}
