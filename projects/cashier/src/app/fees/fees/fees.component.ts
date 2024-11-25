import { Component } from '@angular/core';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TournamentService } from '../../../../../common/services/tournament.service';
import { club_tournament } from '../../../../../common/ffb/interface/club_tournament.interface';
import { Person } from '../../../../../common/ffb/interface/tournament_teams.interface';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../../../../../common/member.interface';

interface Gamer {
  license: string;
  firstname: string;
  lastname: string;
  is_member: Member | undefined;
  games_credit: number;
  index: number;
  selection: string;
  in_euro: number;
  validated: boolean;

}


@Component({
  selector: 'app-fees',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './fees.component.html',
  styleUrl: './fees.component.scss'
})
export class FeesComponent {

  next_tournaments: club_tournament[] = [];
  selected_tournament: club_tournament | null = null;
  gamers: Gamer[] = [];
  members: Member[] = [];
  alphabetic_sort: boolean = false;

  constructor(
    private toastService: ToastService,
    private membersService: MembersService,
    private tournamentService: TournamentService

  ) {
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

    this.tournamentService.list_next_tournaments().subscribe((next_tournaments) => {
      this.next_tournaments = next_tournaments;
    });
  }

  check_all() {
    this.gamers.forEach((gamer) => gamer.validated = gamer.is_member ? true : false);
  }

  toggle_sort() {
    this.alphabetic_sort = !this.alphabetic_sort;
    if (this.alphabetic_sort) {
      this.gamers = this.gamers.sort((a, b) => a.lastname.localeCompare(b.lastname));
    } else {
      this.gamers = this.gamers.sort((a, b) => a.index - b.index);
    }
  }

  save_fees() {
    console.log('gamers', this.gamers);
    // check if all non-members have been validated
    let non_members = this.gamers.filter((gamer) => !gamer.is_member);
    let non_members_validated = non_members.every((gamer) => gamer.validated);
    if (!non_members_validated) {
      this.toastService.showWarningToast('droits de table', 'tous les non-adhérents doivent être validés');
      return;
    }

    // check if all members have been validated
    let members = this.gamers.filter((gamer) => gamer.is_member);
    let members_validated = members.every((gamer) => gamer.validated);
    if (!members_validated) {
      this.toastService.showWarningToast('droits de table', 'tous les adhérents doivent être validés');
      return;
    }
  }

  is_member(license: string): Member | undefined {
    return this.members.find((member) => member.license_number === license);
  }


  person2gamer(person: Person, index: number): Gamer {

    let to_string = (license_number: number): string => {
      return ('00' + license_number).slice(-8);
    }

    let license = to_string(person.license_number);
    let is_member = this.is_member(license);
    let selection = is_member ? 'card' : 'euro';
    let in_euro = is_member ? 3 : 4;
    let games_credit = is_member ? is_member.games_credit : 0;

    return {
      license: license,
      firstname: person.firstname,
      lastname: person.lastname.toUpperCase(),
      is_member: is_member,
      games_credit: games_credit,
      selection: selection,
      index: index,
      in_euro: in_euro,
      validated: false
    };
  }

  tournament_selected(event: any) {
    this.selected_tournament = event;
    // console.log('tournament_selected', event);
    this.tournamentService.readTeams(this.selected_tournament!.team_tournament_id).subscribe((tteams) => {
      let tgamers = tteams.teams
        .filter((team) => !team.is_isolated_player)
        .map((team) => team.players)
        .map((players) => players.map((player) => player.person))
        .map((persons, index_maj) => persons.map((person, index_min) => (this.person2gamer(person, index_maj * 2 + index_min))));
      this.gamers = tgamers.flat();

      console.log('tournament_selected', this.gamers);
    });
  };


}

