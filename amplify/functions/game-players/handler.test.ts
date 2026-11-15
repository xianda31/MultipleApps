import assert from 'node:assert/strict';
import test from 'node:test';
import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { documentClient, mutatePlayers } from './handler';
import { decodeGamePlayers, rosterSignature } from '../../../projects/admin/src/app/back/fees/fees-collector/fees-pairs.util';
import type { Gamer, GameCheckIn, GamePlayersAction } from '../../../projects/admin/src/app/back/fees/fees.interface';

process.env['GAME_TABLE_NAME'] = 'Game';
process.env['GAME_CHECK_IN_TABLE_NAME'] = 'GameCheckIn';
process.env['GAME_SETTLEMENT_TABLE_NAME'] = 'GameSettlement';

function player(index: number): Gamer {
  return {
    license: String(index + 1).padStart(8, '0'), index, firstname: 'Jean', lastname: 'Test',
    is_member: false, validated: false, enabled: true, in_euro: false,
    game_credits: 0, debt: 0, credit: 0, price: 5, photo_url$: null, member_id: null, my_birthday: null,
  };
}

for (const scenario of ['add', 'remove', 'replace', 'legacy-string', 'closing', 'closing-race', 'stale-roster', 'check-in', 'stale-check-in', 'pointage-race', 'removal-race'] as const) {
  test(`atomic tournament players: ${scenario}`, async context => {
    let players = [player(0), player(1), player(2), player(3)];
    let version = 2;
    const checkIns = new Map<string, GameCheckIn>();
    let committed = 0;
    let attempts = 0;
    let closing = scenario === 'closing';
    let transaction: TransactWriteCommand['input'] | undefined;
    const snapshot = rosterSignature(players);
    const storedGame = () => ({
      gameId: 'game', season: '2026', fee_rate: 'standard', member_trn_price: 3, non_member_trn_price: 5,
      alphabetic_sort: false, fees_doubled: false,
      gamers: scenario === 'legacy-string' ? JSON.stringify(players) : players, playersVersion: version,
      createdAt: '2026-11-15T10:00:00.000Z', updatedAt: '2026-11-15T10:00:01.000Z',
    });
    const pointed: GameCheckIn = {
      gameId: 'game', license: player(0).license, mode: 'euro', source: 'manual',
      updatedBy: 'other', updatedAt: '2026-11-15T10:01:00.000Z',
    };
    if (scenario === 'stale-check-in') checkIns.set(pointed.license, pointed);
    context.mock.method(documentClient, 'send', async (command: unknown) => {
      if (command instanceof GetCommand) {
        assert.equal(command.input.ConsistentRead, true);
        if (command.input.TableName === 'Game') return { Item: storedGame() };
        if (command.input.TableName === 'GameSettlement') return { Item: closing ? { status: 'closing' } : undefined };
        if (command.input.TableName === 'GameCheckIn') return { Item: checkIns.get(String(command.input.Key?.['license'])) };
      }
      if (command instanceof TransactWriteCommand) {
        transaction = command.input;
        attempts++;
        if (attempts === 1 && (scenario === 'pointage-race' || scenario === 'removal-race' || scenario === 'closing-race')) {
          version++;
          if (scenario === 'pointage-race') checkIns.set(pointed.license, pointed);
          else if (scenario === 'closing-race') closing = true;
          else players = players.slice(2);
          const error = new Error('Concurrent update');
          error.name = 'TransactionCanceledException';
          throw error;
        }
        committed++;
        return {};
      }
      throw new Error('Unexpected database command');
    });
    const action: GamePlayersAction = ['check-in', 'stale-check-in', 'removal-race'].includes(scenario)
      ? { type: 'check-in', license: player(0).license, mode: 'card', source: 'manual', expectedVersion: null }
      : scenario === 'add' ? { type: 'add', players: [player(4), player(5)] }
      : scenario === 'replace'
        ? { type: 'replace', license: player(0).license, player: player(8) }
        : { type: 'remove', pairId: 'legacy-0' };
    const run = () => mutatePlayers('game', action, scenario === 'stale-roster' ? 'outdated' : snapshot, 'operator');
    if (scenario === 'closing' || scenario === 'closing-race') await assert.rejects(run, /clôture/);
    else if (scenario === 'stale-roster' || scenario === 'stale-check-in') await assert.rejects(run, /changé/);
    else if (scenario === 'pointage-race') await assert.rejects(run, /déjà pointé/);
    else if (scenario === 'removal-race') await assert.rejects(run, /plus inscrit/);
    else {
      const saved = await run();
      assert.equal(saved.playersVersion, 3);
      assert.ok(Array.isArray(saved.gamers));
      const savedPlayers = decodeGamePlayers(saved.gamers);
      assert.deepEqual(transaction?.TransactItems?.[1].Update?.ExpressionAttributeValues?.[':players'], saved.gamers);
      if (scenario === 'add') {
        assert.equal(savedPlayers.length, 6);
        assert.equal(savedPlayers[4].pair_id, savedPlayers[5].pair_id);
        assert.notEqual(savedPlayers[4].pair_id, savedPlayers[0].pair_id);
      }
      if (scenario === 'remove' || scenario === 'legacy-string') assert.deepEqual(savedPlayers.map(candidate => candidate.index), [2, 3]);
      if (scenario === 'replace') {
        assert.equal(savedPlayers[0].license, player(8).license);
        assert.equal(savedPlayers[0].pair_id, 'legacy-0');
        assert.equal(savedPlayers[0].validated, false);
      }
      if (scenario === 'check-in') {
        assert.equal(savedPlayers[0].validated, true);
        assert.equal(transaction?.TransactItems?.filter(item => item.Put?.TableName === 'GameCheckIn').length, 1);
      }
      assert.equal(committed, 1);
      assert.equal(transaction?.TransactItems?.[0].ConditionCheck?.TableName, 'GameSettlement');
      assert.equal(transaction?.TransactItems?.[1].Update?.ConditionExpression, 'playersVersion = :previous');
      assert.equal(transaction?.TransactItems?.[1].Update?.ExpressionAttributeValues?.[':previous'], 2);
    }
    if (!['add', 'remove', 'replace', 'legacy-string', 'check-in'].includes(scenario)) assert.equal(committed, 0);
  });
}
