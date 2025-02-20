import { Injectable } from '@angular/core';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Game_credit, Member } from '../../../../../common/member.interface';
import { MAX_CREDITS_HISTORY } from '../fees.interface';
import { ToastService } from '../../../../../common/toaster/toast.service';

@Injectable({
  providedIn: 'root'
})
export class FeesEditorService {


  members: Member[] = [];
  constructor(
    private membersService: MembersService,
    private toastService: ToastService,

  ) {
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });
  }

  add_game_credit(event: string, member_id: string, amount: number) {
    let game_credit: Game_credit = {
      tag: event + ' ' + new Date().toLocaleDateString('fr-FR').split('/').slice(0, 2).join('-'),
      amount: amount + this.get_current_game_credit(member_id)
    };
    let credits = this.get_game_credits(member_id);
    credits.push(game_credit);
    if (credits.length > MAX_CREDITS_HISTORY) {
      credits.shift();
    }
    this.update_member_game_credits(member_id, credits);

  }

  get_game_credits(member_id: string): Game_credit[] {
    let member = this.members.find(member => member.id == member_id);
    if (member) {
      return member.game_credits ?? [];
    } else {
      console.log('member not found', member_id);
      throw new Error('member not found');
    }
  }

  get_current_game_credit(member_id: string): number {
    let credits = this.get_game_credits(member_id);
    if (credits.length > 0) {
      return credits[credits.length - 1].amount;
    } else {
      return 0;
    }
  }

  update_member_game_credits(member_id: string, credits: Game_credit[]) {
    let member = this.members.find(member => member.id == member_id);
    if (member) {
      member.game_credits = credits;
      // console.log('save member', member);
      this.membersService.updateMember(member)
        .then(() => {
          this.toastService.showSuccessToast(member.lastname + ' ' + member.firstname, 'solde mis à jour');
        });
    } else {
      console.log('member not found', member_id);
      throw new Error('member not found');
    }
  }

  // TODO : à améliorer en terme de configurabilité des constantes
  tournament_card_sold(date: string, member: Member, paied: number) {
    if (member) {
      this.add_game_credit('vente du ' + date, member.id, paied === 15 ? 6 : 12);
    }
  }
}
