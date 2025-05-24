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

  add_game_credit(event: string, member:Member, amount: number) {
    let game_credit: Game_credit = {
      tag: event + ' ' + new Date().toLocaleDateString('fr-FR').split('/').slice(0, 2).join('-'),
      amount: amount + this.get_current_game_credit(member)
    };
    let credits = this.get_game_credits(member);
    credits.push(game_credit);
    if (credits.length > MAX_CREDITS_HISTORY) {
      credits.shift();
    }
    this.update_member_game_credits(member, credits);
    this.toastService.showSuccessToast('Gestion des cartes tournoi', this.membersService.first_then_last_name(member) + ' : '+ amount + ' parties créditées');

  }

  get_game_credits(member:Member): Game_credit[] {
    return member.game_credits ?? [];
  }

  get_current_game_credit(member:Member): number {
    let credits = this.get_game_credits(member);
    if (credits.length > 0) {
      return credits[credits.length - 1].amount;
    } else {
      return 0;
    }
  }

  update_member_game_credits(member:Member, credits: Game_credit[]) {
      member.game_credits = credits;
      // console.log('save member', member);
      this.membersService.updateMember(member)
        .then(() => {this.toastService.showSuccessToast(member.lastname + ' ' + member.firstname, 'solde mis à jour');        })
  .catch((err) => {
      this.toastService.showErrorToast('Gestion des cartes tournoi', 'Erreur lors de la mise à jour du solde');
    });
  }

  tournament_card_sold(date: string, member: Member, qty: number) {
      this.add_game_credit('vente du ' + date, member, qty);
  }
}
