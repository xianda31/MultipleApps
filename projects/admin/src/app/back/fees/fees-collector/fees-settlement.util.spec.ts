import { GameSettlement, GameSettlementContext } from '../fees.interface';
import { canResumeGameSettlement } from './fees-settlement.util';

describe('canResumeGameSettlement', () => {
  const now = Date.parse('2026-11-03T08:00:00.000Z');
  const context: GameSettlementContext = {
    lockedBy: 'operator',
    resumeToken: 'device',
    tabId: 'current-tab',
    clientBuild: 'abcdef0',
    totalCardPayers: 16,
    staleAfterMs: 30_000,
  };

  function settlement(overrides: Partial<GameSettlement> = {}): GameSettlement {
    return {
      gameId: '2026/2027_508878',
      status: 'closing',
      lockedBy: 'operator',
      resumeToken: 'device',
      tabId: 'previous-tab',
      heartbeatAt: '2026-11-03T07:59:00.000Z',
      ...overrides,
    };
  }

  it('immediately resumes a reload in the same tab', () => {
    expect(canResumeGameSettlement(
      settlement({ tabId: context.tabId, heartbeatAt: new Date(now).toISOString() }),
      context,
      now,
    )).toBeTrue();
  });

  it('waits for a different tab heartbeat to expire', () => {
    expect(canResumeGameSettlement(
      settlement({ heartbeatAt: '2026-11-03T07:59:45.000Z' }),
      context,
      now,
    )).toBeFalse();
    expect(canResumeGameSettlement(
      settlement({ heartbeatAt: '2026-11-03T07:59:29.999Z' }),
      context,
      now,
    )).toBeTrue();
  });

  it('never resumes after the browser recovery token is lost', () => {
    expect(canResumeGameSettlement(
      settlement({ resumeToken: 'previous-device', heartbeatAt: null }),
      context,
      now,
    )).toBeFalse();
  });
});
