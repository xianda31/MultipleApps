import { Injectable } from '@angular/core';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { TournamentService } from '../../../../../common/services/tournament.service';
import { Person, Player, Team, TournamentTeams } from '../../../../../common/ffb/interface/tournament_teams.interface';
import { BehaviorSubject, map, Observable, of, tap } from 'rxjs';
import { SystemDataService } from '../../../../../common/services/system-data.service';
import { ProductService } from '../../../../../common/services/product.service';
import { Game_credit, Member } from '../../../../../common/member.interface';
import { Game, Gamer } from '../fees.interface';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { club_tournament } from '../../../../../common/ffb/interface/club_tournament.interface';
import { FeesEditorService } from '../fees-editor/fees-editor.service';
import { BookService } from '../../book.service';




@Injectable({
  providedIn: 'root'
})
export class FeesCollectorService {
  game: Game = {
    season: '',
    member_trn_price: 0,
    non_member_trn_price: 0,
    alphabetic_sort: false,
    fees_doubled: false,
    gamers: [],
    tournament: null,
  };
  _game$: BehaviorSubject<Game> = new BehaviorSubject<Game>(this.game);
  members: Member[] = [];



  constructor(
    private toastService: ToastService,
    private membersService: MembersService,
    private tournamentService: TournamentService,
    private systemDataService: SystemDataService,
    private feesEditorService: FeesEditorService,
    private BookService: BookService


  ) {
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
    });

    this.systemDataService.get_configuration().subscribe((sys_conf) => {
      this.game = {
        season: sys_conf.season,
        member_trn_price: +sys_conf.member_trn_price,
        non_member_trn_price: +sys_conf.non_member_trn_price,
        alphabetic_sort: false,
        fees_doubled: false,
        gamers: [],
        tournament: null,
      };

    });

  }

  get game$(): Observable<Game> {
    return this._game$.asObservable();
  }

  private is_member(license: string): Member | undefined {
    return this.members.find((member) => member.license_number === license);
  }

  person2gamer(person: Person, index: number): Gamer {

    let to_string = (license_number: number): string => {
      return ('00' + license_number).slice(-8);
    }

    let license = to_string(person.license_number);
    let is_member = this.is_member(license);
    let in_euro = !is_member;
    let price = is_member ? this.game.member_trn_price : this.game.non_member_trn_price;

    let game_credits = (is_member !== undefined) ? this.feesEditorService.get_current_game_credit(is_member.id) : 0;

    return {
      license: license,
      firstname: person.firstname,
      lastname: person.lastname.toUpperCase(),
      is_member: is_member,
      game_credits: game_credits,
      in_euro: in_euro,
      index: index,
      price: price,
      validated: false
    };
  }


  toggle_fee() {
    this.game.fees_doubled = !this.game.fees_doubled;
    let factor = this.game.fees_doubled ? 2 : 1;
    this.game.gamers.forEach((gamer) => {
      gamer.price = gamer.is_member ? this.game.member_trn_price * factor : this.game.non_member_trn_price * factor;
    });
    this._game$.next(this.game);
  }

  toggle_sort() {
    this.game.alphabetic_sort = !this.game.alphabetic_sort;
    if (this.game.alphabetic_sort) {
      this.game.gamers = this.game.gamers.sort((a, b) => a.lastname.localeCompare(b.lastname));
    } else {
      this.game.gamers = this.game.gamers.sort((a, b) => a.index - b.index);
    }
    this._game$.next(this.game)
  }

  check_all_members() {
    this.game.gamers.forEach((gamer) => gamer.validated = gamer.is_member ? true : false);
    this._game$.next(this.game)
  }



  set_tournament(tournament: club_tournament) {

    this.game.fees_doubled = tournament.tournament_name.includes('ROY') ? true : false;

    this.tournamentService.readTeams(tournament!.team_tournament_id).pipe(
      map((tteams: TournamentTeams) => tteams.teams),
      map((teams: Team[]) => teams.filter((team) => !team.is_isolated_player)),
      map((teams: Team[]) => teams.map((team) => team.players)),
      map((players: Player[][]) => players.flat()),
      map((players: Player[]) => players.map((player) => player.person)),
    ).subscribe((persons: Person[]) => {
      this.game.gamers = persons.map((person, index) => this.person2gamer(person, index));
      this.game.tournament = tournament;
      this._game$.next(this.game)
    }
    );
  }

  save_fees() {
    // console.log('save_fees', this.game);

    // check if all non-members have been validated
    let non_members = this.game.gamers.filter((gamer) => !gamer.is_member);
    let non_members_validated = non_members.every((gamer) => gamer.validated);
    if (!non_members_validated) {
      this.toastService.showWarningToast('droits de table', 'tous les non-adhérents doivent être validés');
      return;
    }

    // check if all members have been validated
    let members = this.game.gamers.filter((gamer) => gamer.is_member);
    let members_validated = members.every((gamer) => gamer.validated);
    if (!members_validated) {
      this.toastService.showWarningToast('droits de table', 'tous les adhérents doivent être validés');
    }
    // sum-up non-members and members fees in euros
    let non_members_euros = non_members.reduce((acc, gamer) => acc + gamer.price, 0);
    let members_euros = members.reduce((acc, gamer) => acc + (gamer.in_euro ? gamer.price : 0), 0);
    console.log('non_members_euros', non_members_euros);
    console.log('members_euros', members_euros);

    this.BookService.create_tournament_fees_entry(this.game.tournament!.date, non_members_euros + members_euros);
    // charge members game_credits

    members.forEach((gamer) => {
      if (!gamer.in_euro) {
        let member = gamer.is_member as Member;
        let amount = gamer.price;
        this.feesEditorService.add_game_credit('tournoi du' + this.game.tournament!.date, member.id, this.game.fees_doubled ? 2 : 1);
      }
    });

  }


}
