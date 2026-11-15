import { Gamer } from '../fees.interface';
import { changePairPlayers, decodeGamePlayers, gamerPairs, rosterSignature } from './fees-pairs.util';

describe('persisted tournament pairs', () => {
  function player(index: number, overrides: Partial<Gamer> = {}): Gamer {
    return {
      license: String(index + 1).padStart(8, '0'), index, firstname: 'Jean', lastname: 'Test',
      is_member: false, validated: false, enabled: true, in_euro: false,
      game_credits: 0, debt: 0, credit: 0, price: 5, photo_url$: null, member_id: null, my_birthday: null,
      ...overrides,
    };
  }

  it('reads native AWSJSON arrays and previously encoded lists without losing check-ins', () => {
    const players = [player(0, { validated: true, check_in_updated_at: 'saved' }), player(1)];
    for (const payload of [players, JSON.stringify(players), JSON.stringify(JSON.stringify(players))]) {
      expect(decodeGamePlayers(payload)).toEqual(players);
    }
  });

  it('rejects malformed lists rather than silently dropping players', () => {
    for (const payload of [null, {}, [player(0), null], [{ ...player(0), license: 123 }]]) {
      expect(() => decodeGamePlayers(payload)).toThrowError(/format/);
    }
  });

  it('recovers legacy pairs by original slots, not by current sort or missing players', () => {
    const players = [player(3), player(0), player(2), player(6)];
    expect(gamerPairs(players).map(pair => pair.players.map(candidate => candidate.index))).toEqual([[0], [2, 3], [6]]);
    expect(rosterSignature(players)).toBe(rosterSignature([...players].reverse()));
  });

  it('keeps stable pair identities after deletion, addition and replacement', () => {
    const original = [player(0), player(1), player(2), player(3)];
    const removed = changePairPlayers(original, { type: 'remove', pairId: 'legacy-0' }, 'unused');
    const added = changePairPlayers(removed, { type: 'add', players: [player(4), player(5)] }, 'new-pair');
    expect(gamerPairs(added).map(pair => pair.id)).toEqual(['legacy-1', 'new-pair']);
    expect(added.map(candidate => candidate.index)).toEqual([2, 3, 4, 5]);
    const replaced = changePairPlayers(added, {
      type: 'replace', license: player(2).license,
      player: player(8, { validated: true, in_euro: true, check_in_updated_at: 'old', price: 7 }),
    }, 'unused');
    expect(replaced[0]).toEqual(jasmine.objectContaining({
      license: player(8).license, index: 2, pair_id: 'legacy-1', validated: false, in_euro: false, price: 7,
    }));
    expect(replaced[0].check_in_updated_at).toBeUndefined();
    expect(replaced[1].license).toBe(player(3).license);
    expect(original.length).toBe(4);
    expect(original[0].pair_id).toBeUndefined();
  });

  it('forbids deletion of a checked-in pair and replacement of a checked-in player', () => {
    const players = [player(0, { validated: true }), player(1)];
    expect(() => changePairPlayers(players, { type: 'remove', pairId: 'legacy-0' }, 'unused')).toThrowError(/Dépointez/);
    expect(() => changePairPlayers(players, { type: 'replace', license: players[0].license, player: player(3) }, 'unused')).toThrowError(/Dépointez/);
    const replaced = changePairPlayers(players, { type: 'replace', license: players[1].license, player: player(3) }, 'unused');
    expect(replaced[0].validated).toBeTrue();
    expect(replaced[1].validated).toBeFalse();
  });

  it('rejects partial additions and duplicate players by license or FFB identity', () => {
    const current = [player(0, { ffb_person_id: 12 }), player(1)];
    expect(() => changePairPlayers(current, { type: 'add', players: [player(2)] }, 'new')).toThrowError(/deux joueurs/);
    expect(() => changePairPlayers(current, { type: 'add', players: [player(2), player(2)] }, 'new')).toThrowError(/différents/);
    expect(() => changePairPlayers(current, {
      type: 'replace', license: current[1].license, player: player(2, { ffb_person_id: 12 }),
    }, 'unused')).toThrowError(/déjà inscrit/);
    expect(() => changePairPlayers(current, {
      type: 'add', players: [player(0), player(2)],
    }, 'new')).toThrowError(/déjà inscrit/);
  });

  it('rejects ambiguous legacy positions rather than guessing partners', () => {
    expect(() => gamerPairs([player(0), player(0)])).toThrowError(/ambiguës/);
  });
});
