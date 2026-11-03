import { GameSettlement, GameSettlementContext } from '../fees.interface';

export function canResumeGameSettlement(
  settlement: GameSettlement,
  context: GameSettlementContext,
  now: number = Date.now(),
): boolean {
  if (settlement.status !== 'closing' || settlement.resumeToken !== context.resumeToken) return false;
  if (settlement.tabId === context.tabId) return true;

  const heartbeatTime = settlement.heartbeatAt ? Date.parse(settlement.heartbeatAt) : Number.NaN;
  return !Number.isFinite(heartbeatTime) || now - heartbeatTime >= context.staleAfterMs;
}
