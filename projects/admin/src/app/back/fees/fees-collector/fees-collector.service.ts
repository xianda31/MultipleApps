import { Injectable } from '@angular/core';
import { TournamentService } from '../../../common/services/tournament.service';
import { Person, Player, Team, TournamentTeams } from '../../../common/ffb/interface/tournament_teams.interface';
import { BehaviorSubject, map, Observable, of, Subject, Subscription } from 'rxjs';
import { SystemDataService } from '../../../common/services/system-data.service';
import { Member } from '../../../common/interfaces/member.interface';
import { Game, Gamer } from '../fees.interface';
import { club_tournament } from '../../../common/ffb/interface/club_tournament.interface';
import { BookService } from '../../services/book.service';
import { GameCardService } from '../../services/game-card.service';
import { SystemConfiguration } from '../../../common/interfaces/system-conf.interface';
import { FFBplayer } from '../../../common/ffb/interface/FFBplayer.interface';
import { MembersService } from '../../../common/services/members.service';
import { ToastService } from '../../../common/services/toast.service';
import { DBhandler } from "../../../common/services/graphQL.service";
import { MemberSettingsService } from '../../../common/services/member-settings.service';




@Injectable({
  providedIn: 'root'
})
export class FeesCollectorService {
  tournament: club_tournament | null = null;

  game!: Game;
  _game$: BehaviorSubject<Game> = new BehaviorSubject<Game>(this.game);
  members: Member[] = [];
  sys_conf !: SystemConfiguration;

  constructor(
    private toastService: ToastService,
    private membersService: MembersService,
    private tournamentService: TournamentService,
    private systemDataService: SystemDataService,
    private gameCardService: GameCardService,
    private BookService: BookService,
    private membersSettingsService: MemberSettingsService,
    private DBhandler: DBhandler


  ) {
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
      this.gameCardService.gameCards.subscribe((cards) => {
        // initialize game cards from dynamoDB for next usages
      });
    });

    this.systemDataService.get_configuration().subscribe((sys_conf) => {
      this.sys_conf = sys_conf;
      this.init_game();
    });


  }

  get game$(): Observable<Game> {
    return this._game$.asObservable();
  }


  private init_game() {
    this.game = {
      season: this.sys_conf.season,
      member_trn_price: +this.sys_conf.member_trn_price,
      non_member_trn_price: +this.sys_conf.non_member_trn_price,
      alphabetic_sort: false,
      fees_doubled: false,
      gamers: [],
      tournament: null,
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

  async log_game_state() {
    try {
      const game = await this.DBhandler.readGame(this.game.season, this.game.tournament!.id);
      // Handle the retrieved game data
      if (game) {
        await this.DBhandler.updateGame(this.game);
      } else {
        await this.DBhandler.createGame(this.game);
      }
    } catch (error) {
      console.error('Error storing game:', error);
    }
  }

  private update_members_credits_and_avatar() {
    let members = this.get_members();

    const subscription = this.gameCardService.check_solvencies(members).subscribe({
      next: (solvencies) => {
        this.game.gamers.forEach((gamer) => {
          if (gamer.is_member) {
            let credit = solvencies.get(gamer.license) ?? 0;
            gamer.game_credits = credit;
            gamer.photo_url$ = this.membersSettingsService.getAvatarUrl(this.membersService.getMemberbyLicense(gamer.license)!) ;

          }
        });
        this._game$.next(this.game);
      },
      complete: () => {
        subscription.unsubscribe();
      }
    });
  }



  clear_tournament() {
    this.tournament = null;
  }

  get_tournament(): club_tournament | null {
    return this.tournament;
  }

  async set_tournament(tournament: club_tournament) {
    this.tournament = tournament;

    // check if tournament fees have been already worked on
    const season = this.systemDataService.get_season(new Date());
    const game = await this.DBhandler.readGame(season, tournament.id);
    if (game) {
      this.game = game;
      this.toastService.showSuccess('tournois', 'dernier état de saisie de ce tournoi restauré');
      this.update_members_credits_and_avatar();   // will update gamers game_credits & trigger _game$.next(this.game)
      return
    }

    this.game.fees_doubled = tournament.tournament_name.includes('ROY') ? true : false;

    this.tournamentService.readTeams(tournament!.team_tournament_id).pipe(
      map((tteams: TournamentTeams) => tteams.teams),
      map((teams: Team[]) => teams.filter((team) => !team.is_isolated_player)),
      map((teams: Team[]) => teams.map((team) => team.players)),
      map((players: Player[][]) => players.flat()),
      map((players: Player[]) => players.map((player) => player.person)),
    ).subscribe((persons: Person[]) => {
      this.game.gamers = persons.map((person, index) => this.person2gamer(person, index));

      this.game.tournament = {
        id: tournament.id,
        name: tournament.tournament_name,
        date: tournament.date,
        time: tournament.time
      };

      let factor = this.game.fees_doubled ? 2 : 1;
      this.game.gamers.forEach((gamer) => {
        gamer.price = gamer.is_member ? this.game.member_trn_price * factor : this.game.non_member_trn_price * factor;
      });

      this.update_members_credits_and_avatar();   // will update gamers game_credits & trigger _game$.next(this.game)
    }
    );
  }


  add_player(player: FFBplayer) {
    if (player) {
      let new_gamer: Gamer = {
        license: player.license_number,
        firstname: player.firstname,
        lastname: player.lastname.toUpperCase(),
        is_member: this.is_member(player.license_number),
        game_credits: 0,
        index: this.game.gamers.length,
        in_euro: true, // default to euro
        price: this.game.non_member_trn_price,
        validated: false,
        enabled: true,
        photo_url$: this.is_member(player.license_number) ? this.membersSettingsService.getAvatarUrl(this.membersService.getMemberbyLicense(player.license_number)!) : null
      };
      this.game.gamers.push(new_gamer);
      this.update_members_credits_and_avatar();   // will update gamers game_credits & trigger _game$.next(this.game)
    }
  }

  private is_member(license: string): boolean {
    return this.members.some((member) => member.license_number === license);
  }


  private get_members(): Member[] {
    const members = this.game.gamers
      .filter((gamer) => gamer.is_member)
      .map((gamer) => this.members.find((member) => member.license_number === gamer.license))
      .filter((member): member is Member => member !== undefined);
    return members;
  }



  private person2gamer(person: Person, index: number): Gamer {

    let to_string = (license_number: number): string => {
      return ('00' + license_number).slice(-8);
    }

    let license = to_string(person.license_number);
    let is_member = this.is_member(license);
    let in_euro = !is_member;
    let price = is_member ? this.game.member_trn_price : this.game.non_member_trn_price;

    let game_credits = (is_member) ? this.gameCardService.get_member_credit(license) : 0;

    return {
      license: license,
      firstname: person.firstname,
      lastname: person.lastname.toUpperCase(),
      is_member: is_member,
      game_credits: game_credits,
      in_euro: in_euro,
      index: index,
      price: price,
      validated: false,
      enabled: true,
      photo_url$: is_member ? this.membersSettingsService.getAvatarUrl(this.membersService.getMemberbyLicense(license)!) : null
    };
  }

  euros_collected(): number {
    return this.game.gamers
      .filter((gamer) => gamer.in_euro && gamer.enabled && gamer.validated)
      .reduce((acc, gamer) => acc + gamer.price, 0);
  }
  stamps_collected(): number {
    return this.game.gamers
      .filter((gamer) => !gamer.in_euro && gamer.enabled && gamer.validated)
      .reduce((acc, gamer) => acc + (this.game.fees_doubled ? 2 : 1), 0);
  }

  async save_fees() {

    let check_ok = true;
    // console.log('save_fees', this.game);

    // check if all non-members have been validated
    let non_members = this.game.gamers.filter((gamer) => !gamer.is_member && gamer.enabled);
    let non_members_validated = non_members.every((gamer) => gamer.validated);
    if (!non_members_validated) {
      check_ok = false;
      this.toastService.showWarning('droits de table', 'tous les non-adhérents doivent être validés');
      return;
    }

    // check if all members have been validated
    let members = this.game.gamers.filter((gamer) => gamer.is_member && gamer.enabled);
    let members_validated = members.every((gamer) => gamer.validated);
    if (!members_validated) {
      check_ok = false;
      this.toastService.showWarning('droits de table', 'tous les adhérents doivent être validés');
    }

    // check if all members have enough game credits


    if (check_ok) {
      // sum-up non-members and members fees in euros
      let non_members_euros = non_members.reduce((acc, gamer) => acc + gamer.price, 0);
      let members_euros = members.reduce((acc, gamer) => acc + (gamer.in_euro ? gamer.price : 0), 0);


      // charge members game_credits
      members.forEach((gamer) => {
        if (!gamer.in_euro) {
          let member = this.members.find((member) => member.license_number === gamer.license);
          if (member) {
            this.gameCardService.stamp_member_card(member, this.game.tournament!.date, this.game.fees_doubled);
          } else { throw new Error('Member not found !!!!'); }
        }
      });

      // create bookEntry for tournament fees
      try {
        let total = non_members_euros + members_euros;
        await this.BookService.create_tournament_fees_entry(this.game.tournament!.date, total)
        this.toastService.showSuccess('droits de table', total + ' € de droits de table enregistrés');
      }
      catch (error: unknown) {
        this.toastService.showErrorToast('droits de table', 'Erreur lors de l\'enregistrement des droits de table');
      }
    }

  }

  already_charged(): boolean {
    if (!this.game.tournament) {
      return false;
    }
    const charged = this.BookService.search_tournament_fees_entry(this.game.tournament.date) !== undefined;
    return charged;
  }


}
