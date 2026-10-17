import { BehaviorSubject } from 'rxjs';

import { FEE_RATE, Game, Gamer } from '../fees.interface';
import { FeesCollectorService } from './fees-collector.service';

describe('FeesCollectorService view preferences', () => {
  it('keeps sorting and validated-player filtering for the current tournament', () => {
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    const game = createGame(1, [
      createGamer(1, 'ZULU'),
      createGamer(2, 'ALPHA'),
    ]);
    service.game = game;
    service._game$ = new BehaviorSubject<Game>(game);
    Object.assign(service as object, {
      tournament: { id: 1 },
      viewPreferencesByTournament: new Map(),
    });

    service.toggle_sort();
    expect(service.toggle_hide_validated()).toBeTrue();

    expect(service.game.alphabetic_sort).toBeTrue();
    expect(service.game.gamers.map(gamer => gamer.lastname)).toEqual(['ALPHA', 'ZULU']);
    expect(service.get_view_preferences()).toEqual({
      alphabeticSort: true,
      hideValidated: true,
    });
  });

  it('keeps preferences separate between tournaments', () => {
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    service.game = createGame(1);
    service._game$ = new BehaviorSubject<Game>(service.game);
    Object.assign(service as object, {
      tournament: { id: 1 },
      viewPreferencesByTournament: new Map(),
    });
    service.toggle_sort();
    service.toggle_hide_validated();

    Object.assign(service as object, { tournament: { id: 2 } });
    service.game = createGame(2);

    expect(service.get_view_preferences()).toEqual({
      alphabeticSort: false,
      hideValidated: false,
    });
  });

  it('can force validated players to be shown for a completed tournament', () => {
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    service.game = createGame(1);
    service.game.alphabetic_sort = true;
    service._game$ = new BehaviorSubject<Game>(service.game);
    Object.assign(service as object, {
      tournament: { id: 1 },
      viewPreferencesByTournament: new Map(),
    });
    service.toggle_hide_validated();

    expect(service.set_hide_validated(false)).toBeFalse();
    expect(service.get_view_preferences().hideValidated).toBeFalse();
  });

  function createGame(tournamentId: number, gamers: Gamer[] = []): Game {
    return {
      season: '2026',
      fee_rate: FEE_RATE.STANDARD,
      member_trn_price: 3,
      non_member_trn_price: 5,
      fees_doubled: false,
      alphabetic_sort: false,
      tournament: {
        id: tournamentId,
        name: 'Tournoi',
        date: '2026-10-11',
        time: '14:00',
      },
      gamers,
    };
  }

  function createGamer(index: number, lastname: string): Gamer {
    return {
      license: String(index),
      firstname: 'Joueur',
      lastname,
      is_member: true,
      game_credits: 0,
      debt: 0,
      credit: 0,
      index,
      in_euro: false,
      price: 3,
      validated: false,
      enabled: true,
      photo_url$: null,
      member_id: null,
      my_birthday: null,
    };
  }
});
