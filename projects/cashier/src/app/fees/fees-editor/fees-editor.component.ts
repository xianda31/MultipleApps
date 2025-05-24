import { Component } from '@angular/core';
import { Game_credit, Member } from '../../../../../common/member.interface';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { CommonModule } from '@angular/common';
import { FeesEditorService } from './fees-editor.service';
import { last } from 'rxjs';
import { MAX_CREDITS_HISTORY } from '../fees.interface';

@Component({
  selector: 'app-fees-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fees-editor.component.html',
  styleUrl: './fees-editor.component.scss'
})
export class FeesEditorComponent {

  members: Member[] = [];
  loaded = false;


  constructor(
    private membersService: MembersService,
    private feesEditorService: FeesEditorService,
  ) {

  }


  ngOnInit(): void {
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });
  }


  add_game_credit(event: string, member:Member, amount: number) {
    this.feesEditorService.add_game_credit(event, member, amount);
  }

  // get_game_credits(member:Member): Game_credit[] {
  //   return this.feesEditorService.get_game_credits(member);
  // }

  get_current_game_credit(member:Member): number {
    return this.feesEditorService.get_current_game_credit(member);
  }

  update_member_game_credits(member:Member, credits: Game_credit[]) {
    this.feesEditorService.update_member_game_credits(member, credits);
  }

  show_game_credits(member:Member) {
    let credits = this.feesEditorService.get_game_credits(member);
    credits.forEach(credit => {
      console.log(credit.tag, credit.amount);
    });
  }

}
