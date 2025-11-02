import { Injectable } from '@angular/core';
import { TournamentService } from '../../../common/services/tournament.service';
import { Person, Player, Team, TournamentTeams } from '../../../common/ffb/interface/tournament_teams.interface';
import { BehaviorSubject, map, Observable, of, Subject, Subscription } from 'rxjs';
import { SystemDataService } from '../../../common/services/system-data.service';
import { Member } from '../../../common/interfaces/member.interface';
import { club_tournament_extended, FEE_RATE, Game, Gamer } from '../fees.interface';
import { club_tournament } from '../../../common/ffb/interface/club_tournament.interface';
import { BookService } from '../../services/book.service';
import { GameCardService } from '../../services/game-card.service';
import { Fee_rate, SystemConfiguration } from '../../../common/interfaces/system-conf.interface';
import { FFBplayer } from '../../../common/ffb/interface/FFBplayer.interface';
import { MembersService } from '../../../common/services/members.service';
import { ToastService } from '../../../common/services/toast.service';
import { DBhandler } from "../../../common/services/graphQL.service";
import { MemberSettingsService } from '../../../common/services/member-settings.service';




@Injectable({
  providedIn: 'root'
})
export class FeesCollectorService {
  private tournament: club_tournament_extended | null = null;

  game: Game = {} as Game;
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
    this.systemDataService.get_configuration().subscribe((sys_conf) => {
      this.sys_conf = sys_conf;
      this.game.season = sys_conf.season;
      // this.init_game();
    });
    this.membersService.listMembers().subscribe((members) => {
      this.members = members;
      this.gameCardService.gameCards.subscribe((cards) => {
        // initialize game cards from dynamoDB for next usages
      });
    });
  }

  get game$(): Observable<Game> {
    return this._game$.asObservable();
  }



  get_fee_rate(type: FEE_RATE): Fee_rate {
    const fee_rate = this.sys_conf.fee_rates.find((rate) => rate.key === type);
    if (!fee_rate) {
      throw new Error(`Fee rate type ${type} not found`);
    }
    return fee_rate;
  }

  change_fee_rate(new_rate: FEE_RATE) {
    this.game.fee_rate = new_rate;
    let fee_rate = this.get_fee_rate(new_rate);
    this.game.member_trn_price = +fee_rate.member_price;
    this.game.non_member_trn_price = +fee_rate.non_member_price;
    let factor = this.game.fees_doubled ? 2 : 1;
    this.game.gamers.forEach((gamer) => {
      gamer.price = gamer.is_member ? this.game.member_trn_price * factor : this.game.non_member_trn_price * factor;
    });
    if (fee_rate.key === FEE_RATE.ACCESSION) {
      // use acc_credits where possible
      this.game.gamers.forEach((gamer) => {
        if (gamer.is_member && gamer.acc_credits) {
          gamer.enabled = false;
        }
      });
    }
    this._game$.next(this.game);
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

  private update_members_assets() {
    let members = this.get_members();

    const subscription = this.gameCardService.check_solvencies(members).subscribe({
      next: (solvencies) => {
        this.game.gamers.forEach((gamer) => {
          if (gamer.is_member) {
            let credit = solvencies.get(gamer.license) ?? 0;
            gamer.game_credits = credit;
            gamer.photo_url$ = this.membersSettingsService.getAvatarUrl(this.membersService.getMemberbyLicense(gamer.license)!);
          }
        });

        if (this.game.fee_rate === FEE_RATE.ACCESSION) {
          this.game.gamers.forEach((gamer) => {
            if (gamer.is_member && gamer.acc_credits) {
              gamer.enabled = false;
              gamer.validated = true;
            }
          });
        }

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

  async set_tournament(tournament: club_tournament_extended) {
    this.tournament = tournament;

    // check if tournament already traced
    // not_traced => load_game()
    // traced => check if already charged
    //     - charged => inform user and load traced state
    //    - not charged => restore traced state and inform user this is a restored state

    const season = this.systemDataService.get_season(new Date());
    let game = await this.DBhandler.readGame(season, tournament.id);
    if (!game) {
      this.set_game(tournament);
      this.tournament.status = 'initial';
    } else {
      const already_charged = this.BookService.search_tournament_fees_entry(tournament.tournament_name) !== undefined;
      if (already_charged) {
        this.tournament.status = 'terminé';
        this.game = game; // restore previous game state
        this.generate_member_images();
        this._game$.next(this.game);
      } else {
        this.tournament.status = 'entamé';
        this.game = game; // restore previous game state
        this.generate_member_images();
        this.update_members_assets();
        // this.set_game(tournament);
      }
    }
  }
  async check_tournament_status(tournament: club_tournament): Promise<'initial' | 'entamé' | 'terminé'> {
    const season = this.systemDataService.get_season(new Date());
    let game : Game | null = null;
    try {
      game = await this.DBhandler.readGame(season, tournament.id);
      if (!game) {
        return 'initial';
      }
      const already_charged = this.BookService.search_tournament_fees_entry(tournament.tournament_name) !== undefined;
      if (already_charged) {
        return 'terminé';
      }
      return 'entamé';
    } catch (error) {
      console.error('Error checking game %o status:%d', game, error);
      return 'entamé';
    }
  }


  async restore_game_state(): Promise<boolean> {
    if (!this.tournament) {
      this.toastService.showErrorToast('restauration', 'Aucun tournoi sélectionné pour la restauration');
      return false;
    }
    const season = this.systemDataService.get_season(new Date());
    let game = await this.DBhandler.readGame(season, this.tournament.id);
    if (game) {
      this.game = game;
      this.update_members_assets();
      return true;
    } else {
      this.toastService.showErrorToast('restauration', 'Aucun état de saisie trouvé pour ce tournoi');
      return false;
    }
  }


  set_game(tournament: club_tournament) {
    this.game.season = this.sys_conf.season;
    this.game.alphabetic_sort = false;
    this.game.fees_doubled = tournament.tournament_name.includes('ROY') ? true : false;
    this.game.fee_rate = (tournament.tournament_name.includes('ELEVES') || tournament.tournament_name.includes('ACCESSION')) ? FEE_RATE.ACCESSION : FEE_RATE.STANDARD;
    this.game.member_trn_price = +this.get_fee_rate(this.game.fee_rate).member_price;
    this.game.non_member_trn_price = +this.get_fee_rate(this.game.fee_rate).non_member_price;
    this.game.tournament = {
      id: tournament.id,
      name: tournament.tournament_name,
      date: tournament.date,
      time: tournament.time
    };

    this.game.gamers = [];

    this.tournamentService.readTeams(tournament!.team_tournament_id).pipe(
      map((tteams: TournamentTeams) => tteams.teams),
      map((teams: Team[]) => teams.filter((team) => !team.is_isolated_player)),
      map((teams: Team[]) => teams.map((team) => team.players)),
      map((players: Player[][]) => players.flat()),
      map((players: Player[]) => players.map((player) => player.person)),
    ).subscribe((persons: Person[]) => {
      this.game.gamers = persons.map((person, index) => this.person2gamer(person, index));


      let factor = this.game.fees_doubled ? 2 : 1;
      this.game.gamers.forEach((gamer) => {
        gamer.price = gamer.is_member ? this.game.member_trn_price * factor : this.game.non_member_trn_price * factor;
      });

      this.update_members_assets();   // will update gamers game_credits & trigger _game$.next(this.game)
    }
    );
  }


  add_player(player: FFBplayer) {
    let factor = this.game.fees_doubled ? 2 : 1;
    if (player) {
      let new_gamer: Gamer = {
        license: player.license_number,
        firstname: player.firstname,
        lastname: player.lastname.toUpperCase(),
        is_member: this.is_member(player.license_number),
        game_credits: 0,
        acc_credits: (this.is_member(player.license_number)) ? this.check_acc(this.membersService.full_name(this.membersService.getMemberbyLicense(player.license_number)!)) : false,
        index: this.game.gamers.length,
        in_euro: true, // default to euro
        price: this.is_member(player.license_number) ? this.game.member_trn_price * factor : this.game.non_member_trn_price * factor,
        validated: false,
        enabled: true,
        photo_url$: this.is_member(player.license_number) ? this.membersSettingsService.getAvatarUrl(this.membersService.getMemberbyLicense(player.license_number)!) : null
      };
      this.game.gamers.push(new_gamer);
      this.update_members_assets();   // will update gamers game_credits & trigger _game$.next(this.game)
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

  private check_acc(fullname: string): boolean {
    const month_to_quarter = (month: number): number => {
      if (month >= 7 && month <= 11) return 0;  //  juillet à novembre => T1
      if (month === 12 || (month >= 1 && month <= 2)) return 1;  //  décembre à février => T2
      if (month >= 3 && month <= 6) return 2;  //  mars à juin => T3
      throw new Error('Invalid month');
    }

    const check_quarter = (index: number) => {
      if (index > 3) { throw new Error('I quarter overflow'); };
      if (!quarters[index]) {
        quarters[index] = true
      } else {
        check_quarter(index + 1)
      };
    }

    const this_quarter = () => {
      const month = new Date().getMonth();
      return month_to_quarter(month);
    }

    const acc_op_dates = this.BookService.find_member_acc_operations(fullname);
    // associate payment dates to quarter
    let quarters: boolean[] = [false, false, false]; // T1, T2, T3
    acc_op_dates.forEach((date) => {
      const month = new Date(date).getMonth();
      const quarter = month_to_quarter(month);
      check_quarter(quarter);
    });

    return quarters[this_quarter()];
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
    let acc_credits = (is_member) ? this.check_acc(this.membersService.full_name(this.membersService.getMemberbyLicense(license)!)) : false;

    return {
      license: license,
      firstname: person.firstname,
      lastname: person.lastname.toUpperCase(),
      is_member: is_member,
      game_credits: game_credits,
      acc_credits: acc_credits,
      in_euro: in_euro,
      index: index,
      price: price,
      validated: false,
      enabled: true,
      photo_url$: is_member ? this.membersSettingsService.getAvatarUrl(this.membersService.getMemberbyLicense(license)!) : null
    };
  }

  generate_member_images() {
    this.game.gamers.forEach((gamer) => {
      if (gamer.is_member) {
        gamer.photo_url$ = this.membersSettingsService.getAvatarUrl(this.membersService.getMemberbyLicense(gamer.license)!);
      }
    });
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
        await this.BookService.create_tournament_fees_entry(this.game.tournament!.date, this.game.tournament!.name, total)
        this.toastService.showSuccess('droits de table', total + ' € de droits de table enregistrés');
      }
      catch (error: unknown) {
        this.toastService.showErrorToast('droits de table', 'Erreur lors de l\'enregistrement des droits de table');
      }
    }

  }


}
