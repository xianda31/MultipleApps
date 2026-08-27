import { Injectable } from '@angular/core';
import { TournamentService } from '../../../common/services/tournament.service';
import { TournamentTeams } from '../../../common/ffb/interface/tournament.interface';
import { BehaviorSubject, map, Observable, Subscription } from 'rxjs';
import { SystemDataService } from '../../../common/services/system-data.service';
import { Member } from '../../../common/interfaces/member.interface';
import { club_tournament_extended, FEE_RATE, Game, GameCheckIn, GameCheckInMode, GameCheckInSource, GameFeeConfiguration, Game_status, Gamer } from '../fees.interface';
import { club_tournament } from '../../../common/ffb/interface/club_tournament.interface';
import { BookService } from '../../services/book.service';
import { GameCardService } from '../../services/game-card.service';
import { Fee_rate, SystemConfiguration } from '../../../common/interfaces/system-conf.interface';
import { FFBplayer } from '../../../common/ffb/interface/FFBplayer.interface';
import { MembersService } from '../../../common/services/members.service';
import { ToastService } from '../../../common/services/toast.service';
import { DBhandler } from "../../../common/services/graphQL.service";
import { MemberSettingsService } from '../../../common/services/member-settings.service';
import { PaymentMode } from '../../shop/cart/cart.interface';
import { safeGetCurrentUserPromise } from '../../../common/authentification/safe-auth';
import { canSelectGameCard, checkInState, gamerFeePrice, requiredGameCredits, tournamentUsesDoubledFees } from './fees-check-in.util';




@Injectable({
  providedIn: 'root'
})
export class FeesCollectorService {
  private tournament: club_tournament_extended | null = null;
  private checkInSubscription: Subscription | null = null;
  private feeConfigurationSubscription: Subscription | null = null;

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
      this.game.season = sys_conf.season!;
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

  private get gameId(): string | null {
    if (!this.game?.season || !this.game?.tournament) return null;
    return this.DBhandler.create_custom_key(this.game.season, this.game.tournament.id);
  }

  private applyCheckIns(checkIns: GameCheckIn[]): void {
    let changed = false;
    for (const checkIn of checkIns) {
      const gamer = this.game.gamers?.find(candidate => candidate.license === checkIn.license);
      if (!gamer) continue;

      Object.assign(gamer, checkInState(checkIn.mode));
      gamer.check_in_source = checkIn.source;
      gamer.check_in_updated_by = checkIn.updatedBy;
      gamer.check_in_updated_at = checkIn.updatedAt;
      changed = true;
    }
    if (changed) this._game$.next(this.game);
  }

  private startCheckInSync(): void {
    this.stopCheckInSync();
    const gameId = this.gameId;
    if (!gameId) return;

    this.checkInSubscription = this.DBhandler.observeGameCheckIns(gameId).subscribe({
      next: checkIns => this.applyCheckIns(checkIns),
      error: error => {
        console.error('[FeesCollector] GameCheckIn synchronization failed:', error);
        this.toastService.showError('Pointage partagé', 'La synchronisation temps réel est interrompue.');
      },
    });
  }

  private stopCheckInSync(): void {
    this.checkInSubscription?.unsubscribe();
    this.checkInSubscription = null;
  }

  private applyFeeConfiguration(configuration: GameFeeConfiguration, notify: boolean = false): void {
    const changed = this.game.fee_rate !== configuration.feeRate
      || this.game.member_trn_price !== configuration.memberPrice
      || this.game.non_member_trn_price !== configuration.nonMemberPrice
      || this.game.fees_doubled !== configuration.feesDoubled;
    if (!changed) return;

    this.game.fee_rate = configuration.feeRate;
    this.game.member_trn_price = configuration.memberPrice;
    this.game.non_member_trn_price = configuration.nonMemberPrice;
    this.game.fees_doubled = configuration.feesDoubled;
    this.game.gamers?.forEach((gamer) => {
      gamer.price = gamerFeePrice(
        gamer.is_member,
        configuration.memberPrice,
        configuration.nonMemberPrice,
        configuration.feesDoubled,
      );
    });
    this._game$.next(this.game);

    if (notify) {
      this.toastService.showInfo(
        'Configuration du tournoi',
        `Les droits de table ont été modifiés par ${configuration.updatedBy}.`,
      );
    }
  }

  private async currentFeeConfiguration(): Promise<Omit<GameFeeConfiguration, 'updatedAt'>> {
    const gameId = this.gameId;
    if (!gameId) throw new Error('No tournament selected');
    const user = await safeGetCurrentUserPromise();
    return {
      gameId,
      feeRate: this.game.fee_rate,
      memberPrice: this.game.member_trn_price,
      nonMemberPrice: this.game.non_member_trn_price,
      feesDoubled: this.game.fees_doubled,
      updatedBy: user?.username ?? user?.userId ?? 'unknown',
    };
  }

  private async saveFeeConfiguration(
    values: Pick<GameFeeConfiguration, 'feeRate' | 'memberPrice' | 'nonMemberPrice' | 'feesDoubled'>,
  ): Promise<GameFeeConfiguration> {
    const base = await this.currentFeeConfiguration();
    const settlementStatus = await this.DBhandler.readGameSettlementStatus(base.gameId);
    if (settlementStatus) {
      throw new Error(`Tournament settlement is ${settlementStatus}`);
    }
    const configuration = { ...base, ...values };
    const existing = await this.DBhandler.readGameFeeConfiguration(configuration.gameId);
    return existing
      ? this.DBhandler.updateGameFeeConfiguration(configuration)
      : this.DBhandler.initializeGameFeeConfiguration(configuration);
  }

  private async startFeeConfigurationSync(): Promise<void> {
    this.stopFeeConfigurationSync();
    const gameId = this.gameId;
    if (!gameId) return;

    try {
      const initial = await this.DBhandler.initializeGameFeeConfiguration(await this.currentFeeConfiguration());
      this.applyFeeConfiguration(initial);
      this.feeConfigurationSubscription = this.DBhandler.observeGameFeeConfiguration(gameId).subscribe({
        next: configurations => {
          const configuration = configurations[0];
          if (configuration) this.applyFeeConfiguration(configuration, true);
        },
        error: error => {
          console.error('[FeesCollector] Fee configuration synchronization failed:', error);
          this.toastService.showError('Configuration du tournoi', 'La synchronisation temps réel est interrompue.');
        },
      });
    } catch (error) {
      console.error('[FeesCollector] Unable to initialize fee configuration:', error);
      this.toastService.showError('Configuration du tournoi', 'La configuration partagée n’a pas pu être chargée.');
    }
  }

  private stopFeeConfigurationSync(): void {
    this.feeConfigurationSubscription?.unsubscribe();
    this.feeConfigurationSubscription = null;
  }

  private startSharedSync(): void {
    this.startCheckInSync();
    void this.startFeeConfigurationSync();
  }

  async refreshFeeConfiguration(): Promise<void> {
    const gameId = this.gameId;
    if (!gameId) return;
    const configuration = await this.DBhandler.readGameFeeConfiguration(gameId);
    if (configuration) this.applyFeeConfiguration(configuration);
  }

  private currentMode(gamer: Gamer): GameCheckInMode | null {
    if (!gamer.validated) return null;
    if (!gamer.enabled) return 'none';
    return gamer.in_euro ? 'euro' : 'card';
  }

  async setGamerPayment(
    gamer: Gamer,
    mode: GameCheckInMode,
    source: GameCheckInSource = 'manual',
  ): Promise<boolean> {
    const gameId = this.gameId;
    if (!gameId || this.tournament?.status === Game_status.COMPLETED) return false;
    const settlementStatus = await this.DBhandler.readGameSettlementStatus(gameId);
    if (settlementStatus) {
      this.toastService.showWarning('Pointage partagé', 'Le tournoi est en cours de clôture ou déjà clôturé.');
      return false;
    }

    if (source === 'nfc' && mode !== 'card') {
      throw new Error('NFC check-in only supports game-card payments');
    }
    if (source === 'nfc') {
      const remoteCheckIn = await this.DBhandler.readGameCheckIn(gameId, gamer.license);
      if (remoteCheckIn) this.applyCheckIns([remoteCheckIn]);
      if (gamer.check_in_source === 'manual' && this.currentMode(gamer) !== 'card') {
        this.toastService.showInfo('Pointage NFC', `${gamer.firstname} ${gamer.lastname} a déjà été pointé manuellement.`);
        return false;
      }
    }
    if (mode === 'card' && !canSelectGameCard(gamer, this.game.fees_doubled)) {
      const requiredCredits = requiredGameCredits(this.game.fees_doubled);
      this.toastService.showWarning(
        'Carte de jeu',
        `${gamer.firstname} ${gamer.lastname} ne dispose pas des ${requiredCredits} crédit(s) requis.`,
      );
      return false;
    }
    if (source === 'nfc' && this.currentMode(gamer) === 'card') return true;

    const previous = {
      validated: gamer.validated,
      enabled: gamer.enabled,
      in_euro: gamer.in_euro,
      check_in_source: gamer.check_in_source,
      check_in_updated_by: gamer.check_in_updated_by,
      check_in_updated_at: gamer.check_in_updated_at,
    };
    const user = await safeGetCurrentUserPromise();
    const checkIn: Omit<GameCheckIn, 'updatedAt'> = {
      gameId,
      license: gamer.license,
      mode,
      source,
      updatedBy: user?.username ?? user?.userId ?? 'unknown',
    };

    this.applyCheckIns([{ ...checkIn, updatedAt: new Date().toISOString() }]);
    try {
      const saved = await this.DBhandler.upsertGameCheckIn(checkIn);
      this.applyCheckIns([saved]);
      await this.log_game_state();
      return true;
    } catch (error) {
      Object.assign(gamer, previous);
      this._game$.next(this.game);
      console.error('[FeesCollector] Unable to persist check-in:', error);
      this.toastService.showError('Pointage partagé', 'Le pointage n’a pas pu être enregistré.');
      return false;
    }
  }

  async checkInByNfc(license: string): Promise<boolean> {
    const normalizedLicense = license.trim().padStart(8, '0');
    const gamer = this.game.gamers?.find(candidate => candidate.license.padStart(8, '0') === normalizedLicense);
    if (!gamer) {
      this.toastService.showWarning('Pointage NFC', 'Ce badge ne correspond à aucun joueur inscrit.');
      return false;
    }
    return this.setGamerPayment(gamer, 'card', 'nfc');
  }

  async refreshGameCheckIns(): Promise<void> {
    const gameId = this.gameId;
    if (!gameId) return;
    this.applyCheckIns(await this.DBhandler.listGameCheckIns(gameId));
  }



  get_fee_rate(type: FEE_RATE): Fee_rate {
    const fee_rate = this.sys_conf.fee_rates.find((rate) => rate.key === type);
    if (!fee_rate) {
      // If config doesn't contain the requested rate, return a fallback but warn
      console.warn(`Fee rate type ${type} not found in system configuration, using fallback prices`);
      return { key: type, member_price: Number(this.game.member_trn_price ?? 0), non_member_price: Number(this.game.non_member_trn_price ?? 0) } as Fee_rate;
    }
    return fee_rate;
  }


  async change_fee_rate(new_rate: FEE_RATE): Promise<boolean> {
    const prev_rate = this.game.fee_rate;
    let fee_rate = this.get_fee_rate(new_rate);

    this.showFeeRateChangeAlert(
      this.game.member_trn_price,
      fee_rate.member_price,
      this.game.non_member_trn_price,
      fee_rate.non_member_price
    );

    try {
      const saved = await this.saveFeeConfiguration({
        feeRate: new_rate,
        memberPrice: +fee_rate.member_price,
        nonMemberPrice: +fee_rate.non_member_price,
        feesDoubled: this.game.fees_doubled,
      });
      this.applyFeeConfiguration(saved);
    } catch (error) {
      console.error('[FeesCollector] Unable to update fee rate:', error);
      this.toastService.showError('Configuration du tournoi', 'Le changement de tarif n’a pas pu être partagé.');
      return false;
    }

    // If we are leaving ACCESSION, re-enable all gamers and reset validation
    if (prev_rate === FEE_RATE.ACCESSION && new_rate !== FEE_RATE.ACCESSION) {
      this.game.gamers.forEach((gamer) => {
        gamer.enabled = true;
        gamer.validated = false;
      });
    }

    // If the new rate is ACCESSION, disable gamers that can use accession credits
    if (fee_rate.key === FEE_RATE.ACCESSION) {
      this.game.gamers.forEach((gamer) => {
        if (gamer.is_member && gamer.acc_credits) {
          gamer.enabled = false;
          gamer.validated = true;
        }
      });
    }

    this._game$.next(this.game);
    return true;
  }

  private showFeeRateChangeAlert(
    oldMemberPrice: number,
    newMemberPrice: number,
    oldNonMemberPrice: number,
    newNonMemberPrice: number
  ) {
    let alertMsg = '';
    if (this.game.gamers.some(gamer => gamer.is_member && gamer.in_euro) && oldMemberPrice !== newMemberPrice) {
      alertMsg += `Tarif membre modifié : ${oldMemberPrice} € → ${newMemberPrice} €\n`;
    }
    if (this.game.gamers.some(gamer => !gamer.is_member && gamer.in_euro) && oldNonMemberPrice !== newNonMemberPrice) {
      alertMsg += `Tarif non-membre modifié : ${oldNonMemberPrice} € → ${newNonMemberPrice} €\n`;
    }
    if (alertMsg) {
      window.alert(`Attention, vous venez de modifier la tarification du droit de table en espèces :\n\n${alertMsg}\nAssurez-vous de la cohérence des sommes déjà reçues.`);
    }
  }

  async toggle_fee(): Promise<boolean> {
    const feesDoubled = !this.game.fees_doubled;
    const direction = feesDoubled ? 'activer' : 'désactiver';
    window.alert(
      `Attention, vous allez ${direction} les droits doublés.\n\n`
      + 'Les pointages déjà effectués et les sommes déjà collectées ne seront pas annulés. '
      + 'Vous devez vérifier leur cohérence avant la clôture.',
    );
    try {
      const saved = await this.saveFeeConfiguration({
        feeRate: this.game.fee_rate,
        memberPrice: this.game.member_trn_price,
        nonMemberPrice: this.game.non_member_trn_price,
        feesDoubled,
      });
      this.applyFeeConfiguration(saved);
      return true;
    } catch (error) {
      console.error('[FeesCollector] Unable to update doubled fees:', error);
      this.toastService.showError('Configuration du tournoi', 'Le changement des droits doublés n’a pas pu être partagé.');
      return false;
    }
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

  private update_members_debts() {
    let debts = this.BookService.get_debts();
    this.game.gamers.forEach((gamer) => {
      if (gamer.is_member) {
        const fullname = this.membersService.full_name(this.membersService.getMemberbyLicense(gamer.license)!);
        let member_debt = debts.get(fullname);
        gamer.debt = member_debt ? member_debt.total : 0;
      }
    });
  }
  private update_members_credits() {
    let credits = this.BookService.get_customers_assets();
    this.game.gamers.forEach((gamer) => {
      if (gamer.is_member) {
        const fullname = this.membersService.full_name(this.membersService.getMemberbyLicense(gamer.license)!);
        let member_credit = credits.get(fullname);
        gamer.credit = member_credit ? member_credit.total : 0;
      }
    });
  }

  private update_members_assets() {
    let members = this.get_members();

    const subscription = this.gameCardService.check_solvencies(members).subscribe({
      next: (solvencies) => {
        this.game.gamers.forEach((gamer) => {
          if (gamer.is_member) {
            let credit = solvencies.get(gamer.license) ?? 0;
            gamer.game_credits = credit;
            const member = this.membersService.getMemberbyLicense(gamer.license);
            if (!member) {
              console.warn(`[FeesCollectorService] Member flagged as member but not found for license ${gamer.license}`);
              gamer.photo_url$ = null;
              return;
            }
            gamer.photo_url$ = this.membersSettingsService.getAvatarUrl(member);
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
    this.stopCheckInSync();
    this.stopFeeConfigurationSync();
    this.tournament = null;
  }

  get_tournament(): club_tournament_extended | null {
    // check if debt or credit have changed since tournament load
    if (this.tournament) {
      this.update_members_debts();
      this.update_members_credits();
    }
    return this.tournament;
  }

  async set_tournament(tournament: club_tournament_extended) {
    this.stopCheckInSync();
    this.stopFeeConfigurationSync();
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
      this.tournament.status = Game_status.INITIAL;
    } else {
      const tournamentName = game.tournament?.name || tournament.title || 'Tournoi';
      await this.BookService.whenBookEntriesLoaded();
      const already_charged = this.BookService.search_tournament_fees_entry(tournament.date, tournamentName) !== undefined;
      if (already_charged) {
        this.tournament.status = Game_status.COMPLETED;
        this.game = game; // restore previous game state
        this.generate_member_images();
        this._game$.next(this.game);
        this.startSharedSync();
      } else {
        this.tournament.status = Game_status.RECOVERED;
        this.game = game; // restore previous game state
        this.generate_member_images();
        this.update_members_debts();
        this.update_members_credits();
        this.update_members_assets();
        this.startSharedSync();
        // this.set_game(tournament);
      }
    }
  }


  async check_tournament_status(tournament: club_tournament_extended): Promise<Game_status> {
    try {
      // Guard: if sys_conf is not initialized yet, return INITIAL status
      if (!this.sys_conf) {
        console.warn('SystemConfiguration not yet initialized; returning INITIAL status for tournament', tournament.id);
        return Game_status.INITIAL;
      }

      const season = this.systemDataService.get_season(new Date());
      let game: Game | null = null;
      game = await this.DBhandler.readGame(season, tournament.id);
      if (!game) {
        return Game_status.INITIAL;
      }

      // Guard: Only check BookService if members are loaded (sign that initialization is progressing)
      // In degraded mode, members may not be loaded yet, so skip this check
      let already_charged = false;
      try {
        await this.BookService.whenBookEntriesLoaded();
        const tournamentName = game.tournament?.name || tournament.title || 'Tournoi';
        already_charged = this.BookService.search_tournament_fees_entry(tournament.date, tournamentName) !== undefined;
      } catch (bookError) {
        already_charged = false;
      }

      if (already_charged) {
        return Game_status.COMPLETED;
      }
      return Game_status.RECOVERED;
    } catch (error) {
      console.warn('Dependencies not fully initialized in check_tournament_status (expected in degraded mode); returning INITIAL', error);
      return Game_status.INITIAL;
    }
  }

  async reset_tournament_state(tournament: club_tournament_extended) {
    if (tournament.status !== Game_status.RECOVERED) return;
    const season = this.systemDataService.get_season(new Date());
    const gameId = this.DBhandler.create_custom_key(season, tournament.id);
    this.stopCheckInSync();
    this.stopFeeConfigurationSync();
    await this.DBhandler.deleteGameCheckIns(gameId);
    await this.DBhandler.deleteGameFeeConfiguration(gameId);
    await this.DBhandler.deleteGameSettlement(gameId);
    await this.DBhandler.deleteGame(season, tournament.id);
    this.set_game(tournament);
  }

  async restore_game_state(): Promise<boolean> {
    if (!this.tournament) {
      this.toastService.showError('restauration', 'Aucun tournoi sélectionné pour la restauration');
      return false;
    }
    const season = this.systemDataService.get_season(new Date());
    let game = await this.DBhandler.readGame(season, this.tournament.id);
    if (game) {
      this.game = game;
      this.update_members_assets();
      this.update_members_debts();
      this.update_members_credits();
      return true;
    } else {
      this.toastService.showError('restauration', 'Aucun état de saisie trouvé pour ce tournoi');
      return false;
    }
  }


  set_game(tournament: club_tournament_extended) {
    this.game.season = this.sys_conf.season!;
    this.game.alphabetic_sort = false;
    const descriptionLower = (tournament.title ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    this.game.fees_doubled = tournamentUsesDoubledFees(tournament.title);
    this.game.fee_rate = descriptionLower.includes('ete')
      ? FEE_RATE.HOLIDAYS
      : (descriptionLower.includes('eleves') || descriptionLower.includes('accession'))
        ? FEE_RATE.ACCESSION
        : FEE_RATE.STANDARD;
    this.game.member_trn_price = +this.get_fee_rate(this.game.fee_rate).member_price;
    this.game.non_member_trn_price = +this.get_fee_rate(this.game.fee_rate).non_member_price;
    const tournamentDate = new Date(tournament.date);
    const tournamentTime = Number.isNaN(tournamentDate.getTime())
      ? '00:00'
      : `${String(tournamentDate.getHours()).padStart(2, '0')}:${String(tournamentDate.getMinutes()).padStart(2, '0')}`;
    this.game.tournament = {
      id: tournament.id,
      name: tournament.title || 'Tournoi',
      date: tournament.date,
      time: tournamentTime
    };

    this.game.gamers = [];

    this.tournamentService.getTournamentTeams(tournament.id.toString(), { refresh: false }).pipe(
      map((tteams: TournamentTeams) => tteams.items),
      map((items) => items.flatMap((team) => team.players.map((player, idx) => ({ player, teamId: team.id, playerIndex: idx })))),
    ).subscribe((playerData) => {

      // Membership detection is license-based only via FFB native ffbId.
      const gamersOrNull = playerData.map(({ player }, index): Gamer | null => {
        const playerPersonId = typeof player.id === 'number' && Number.isFinite(player.id) ? player.id : undefined;
        const playerLicense = String(player.ffbId ?? '').padStart(8, '0');
        if (!playerLicense || playerLicense === '00000000') {
          console.warn(`[FeesCollectorService] Missing ffbId/license for ${player.firstName} ${player.lastName}; player skipped`);
          return null;
        }

        const member = this.members.find((m) => String(m.license_number ?? '').padStart(8, '0') === playerLicense);
        const isMember = !!member;

        return {
          license: playerLicense,
          firstname: player.firstName,
          lastname: player.lastName,
          is_member: isMember,
          game_credits: isMember ? this.gameCardService.get_member_credit(member!.license_number) : 0,
          acc_credits: member ? this.check_acc(this.membersService.full_name(member!)) : false,
          debt: 0,
          credit: 0,
          index: index,
          in_euro: !isMember,
          price: isMember ? this.game.member_trn_price : this.game.non_member_trn_price,
          validated: false,
          enabled: true,
          photo_url$: member ? this.membersSettingsService.getAvatarUrl(member!) : null,
          member_id: isMember ? member!.id : null,
          my_birthday: isMember ? member!.birthdate : null,
          ffb_person_id: playerPersonId,
        };
      });

      this.game.gamers = gamersOrNull.filter((gamer): gamer is Gamer => gamer !== null);

      let factor = this.game.fees_doubled ? 2 : 1;
      this.game.gamers.forEach((gamer) => {
        gamer.price = gamer.is_member ? this.game.member_trn_price * factor : this.game.non_member_trn_price * factor;
      });

      this.update_members_debts();
      this.update_members_credits();
      this.update_members_assets();   // will update gamers game_credits & trigger _game$.next(this.game)
      this.startSharedSync();
    }
    );
  }


  add_player(player: FFBplayer) {
    let factor = this.game.fees_doubled ? 2 : 1;
    let member = this.is_member(player.license_number);
    if (player) {
      let new_gamer: Gamer = {
        license: player.license_number,
        firstname: player.firstname,
        lastname: player.lastname.toUpperCase(),
        is_member: !!member,
        member_id: member?.id || null,
        my_birthday: member?.birthdate === new Date().toISOString().slice(0, 10) ? new Date().toISOString().slice(0, 10) : null,
        ffb_person_id: player.person_id,

        game_credits: 0,
        acc_credits: (!!member) ? this.check_acc(this.membersService.full_name(member)) : false,
        debt: 0,
        credit: 0,
        index: this.game.gamers.length,
        in_euro: true, // default to euro
        price: !!member ? this.game.member_trn_price * factor : this.game.non_member_trn_price * factor,
        validated: false,
        enabled: true,
        photo_url$: !!member ? this.membersSettingsService.getAvatarUrl(member) : null
      };
      this.game.gamers.push(new_gamer);
      this.update_members_debts();
      this.update_members_credits();
      // Sort gamers after adding new player
      if (this.game.alphabetic_sort) {
        this.game.gamers = this.game.gamers.sort((a, b) => a.lastname.localeCompare(b.lastname));
      } else {
        this.game.gamers = this.game.gamers.sort((a, b) => a.index - b.index);
      }

      this.update_members_assets();   // will update gamers game_credits & trigger _game$.next(this.game)
    }
  }

  private is_member(license: string): Member | null {
    return this.members.find((member) => member.license_number === license) || null;
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
      if (month === 12 || (month >= 0 && month <= 2)) return 1;  //  décembre à février => T2
      if (month >= 3 && month <= 6) return 2;  //  mars à juin => T3
      throw new Error('Invalid month');
    }

    const check_quarter = (index: number) => {
      if (index > 2) {
        // Ne bloque plus l'app, mais signale l'anomalie
        console.warn('Quarter overflow for member', fullname, acc_op_dates);
        if (this.toastService) {
          this.toastService.showWarning('Anomalie trimestre', `Plus de 3 opérations trimestrielles pour ${fullname}`);
        }
        return;
      }
      if (!quarters[index]) {
        quarters[index] = true;
      } else {
        check_quarter(index + 1);
      }
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




  generate_member_images() {
    this.game.gamers.forEach((gamer) => {
      if (gamer.is_member) {
        const member = this.membersService.getMemberbyLicense(gamer.license);
        if (member) {
          gamer.photo_url$ = this.membersSettingsService.getAvatarUrl(member);
        }
      }
    });
  }

  private low_credit_message(member: Member) {
    const fullname = this.membersService.full_name(member);
    this.toastService.showInfo('Crédit faible', `un mail a été envoyé à ${fullname} `);
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

  async save_fees(): Promise<boolean> {
    await this.refreshFeeConfiguration();
    await this.refreshGameCheckIns();

    // check if all non-members have been validated
    let non_members = this.game.gamers.filter((gamer) => !gamer.is_member && gamer.enabled);
    let non_members_validated = non_members.every((gamer) => gamer.validated);
    if (!non_members_validated) {
      this.toastService.showWarning('droits de table', 'tous les non-adhérents doivent être validés');
      return false;
    }

    // check if all members have been validated
    let members = this.game.gamers.filter((gamer) => gamer.is_member && gamer.enabled);
    let members_validated = members.every((gamer) => gamer.validated);
    if (!members_validated) {
      this.toastService.showWarning('droits de table', 'tous les adhérents doivent être validés');
      return false;
    }

    const gameId = this.gameId;
    if (!gameId) return false;
    const user = await safeGetCurrentUserPromise();
    const lockedBy = user?.username ?? user?.userId ?? 'unknown';
    let settlementStatus: 'acquired' | 'closing' | 'completed' | 'failed';
    try {
      settlementStatus = await this.DBhandler.acquireGameSettlement(gameId, lockedBy);
    } catch (error) {
      console.error('[FeesCollector] Unable to acquire settlement lock:', error);
      this.toastService.showError('droits de table', 'Impossible de sécuriser la clôture. Réessayez après vérification de la connexion.');
      return false;
    }
    if (settlementStatus !== 'acquired') {
      const message = settlementStatus === 'completed'
        ? 'Les droits de ce tournoi ont déjà été enregistrés.'
        : settlementStatus === 'failed'
          ? 'Une erreur grave a interrompu une clôture précédente. Une intervention est requise.'
          : 'La clôture est déjà en cours sur un autre appareil.';
      this.toastService.showWarning('droits de table', message);
      return false;
    }

    try {
      await this.refreshFeeConfiguration();
      await this.refreshGameCheckIns();
      non_members = this.game.gamers.filter((gamer) => !gamer.is_member && gamer.enabled);
      members = this.game.gamers.filter((gamer) => gamer.is_member && gamer.enabled);
      if (!non_members.every((gamer) => gamer.validated) || !members.every((gamer) => gamer.validated)) {
        await this.DBhandler.deleteGameSettlement(gameId);
        this.toastService.showWarning('droits de table', 'Le pointage a changé sur un autre appareil. Vérifiez-le avant de clôturer.');
        return false;
      }

      // sum-up non-members and members fees in euros
      let non_members_euros = non_members.reduce((acc, gamer) => acc + gamer.price, 0);
      let members_euros = members.reduce((acc, gamer) => acc + (gamer.in_euro ? gamer.price : 0), 0);

      // charge members game_credits
      for (const gamer of members) {
        if (!gamer.in_euro) {
          let member = this.members.find((member) => member.license_number === gamer.license);
          if (member) {
            const low_credit = await this.gameCardService.stamp_member_card(member, this.game.tournament!.date, this.game.fees_doubled);
            if (low_credit) {
              this.low_credit_message(member);
            }
          } else {
            throw new Error(`Member not found for license ${gamer.license}`);
          }
        }
      }

      // create bookEntry for tournament fees
      let total = non_members_euros + members_euros;
      await this.BookService.create_tournament_fees_entry(this.game.tournament!.date, this.game.tournament!.name, total);
      await this.DBhandler.completeGameSettlement(gameId);
      this.toastService.showSuccess('droits de table', total + ' € de droits de table enregistrés');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[FeesCollector] Tournament settlement failed:', error);
      try {
        await this.DBhandler.failGameSettlement(gameId, message);
      } catch (lockError) {
        console.error('[FeesCollector] Unable to mark settlement as failed:', lockError);
      }
      this.toastService.showError(
        'Clôture interrompue',
        'Une erreur grave est survenue. Aucun nouvel essai automatique ne sera effectué.',
      );
      return false;
    }
  }

  create_game_card_sale(members: Member[], card_price: number, mode: PaymentMode, check_ref?: string): Promise<boolean> {
    const buyer = this.membersService.full_name(members[0]);
    const co_buyer = (members.length > 1) ? this.membersService.full_name(members[1]) : undefined;
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const bookEntry = await this.BookService.create_game_card_sale(buyer, card_price, mode, co_buyer, check_ref);
        const card = await this.gameCardService.createCard(members, undefined, undefined, false, bookEntry.id);
        if (card) {
          this.update_members_debts();  // update debts after sale
          this.update_members_credits(); // update credits after sale
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

}
