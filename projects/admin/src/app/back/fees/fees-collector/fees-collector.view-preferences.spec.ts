import { BehaviorSubject } from 'rxjs';

import { Game } from '../fees.interface';
import { FeesCollectorService } from './fees-collector.service';

describe('FeesCollectorService view preferences', () => {
  it('keeps sorting and validated-player filtering for the current tournament', () => {
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    const game = {
      tournament: { id: 'tournament-1' },
      alphabetic_sort: false,
      gamers: [
        { index: 1, lastname: 'ZULU' },
        { index: 2, lastname: 'ALPHA' },
      ],
    } as Game;
    service.game = game;
    service._game$ = new BehaviorSubject<Game>(game);
    Object.assign(service as object, {
      tournament: { id: 'tournament-1' },
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
    service.game = {
      tournament: { id: 'tournament-1' },
      alphabetic_sort: false,
      gamers: [],
    } as Game;
    service._game$ = new BehaviorSubject<Game>(service.game);
    Object.assign(service as object, {
      tournament: { id: 'tournament-1' },
      viewPreferencesByTournament: new Map(),
    });
    service.toggle_sort();
    service.toggle_hide_validated();

    Object.assign(service as object, { tournament: { id: 'tournament-2' } });
    service.game = {
      tournament: { id: 'tournament-2' },
      alphabetic_sort: false,
      gamers: [],
    } as Game;

    expect(service.get_view_preferences()).toEqual({
      alphabeticSort: false,
      hideValidated: false,
    });
  });

  it('can force validated players to be shown for a completed tournament', () => {
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    service.game = {
      tournament: { id: 'tournament-1' },
      alphabetic_sort: true,
      gamers: [],
    } as Game;
    service._game$ = new BehaviorSubject<Game>(service.game);
    Object.assign(service as object, {
      tournament: { id: 'tournament-1' },
      viewPreferencesByTournament: new Map(),
    });
    service.toggle_hide_validated();

    expect(service.set_hide_validated(false)).toBeFalse();
    expect(service.get_view_preferences().hideValidated).toBeFalse();
  });
});
