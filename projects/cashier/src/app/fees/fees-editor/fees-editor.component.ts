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


  add_game_credit(event: string, member_id: string, amount: number) {
    this.feesEditorService.add_game_credit(event, member_id, amount);
  }

  get_game_credits(member_id: string): Game_credit[] {
    return this.feesEditorService.get_game_credits(member_id);
  }

  get_current_game_credit(member_id: string): number {
    return this.feesEditorService.get_current_game_credit(member_id);
  }

  update_member_game_credits(member_id: string, credits: Game_credit[]) {
    this.feesEditorService.update_member_game_credits(member_id, credits);
  }


}
