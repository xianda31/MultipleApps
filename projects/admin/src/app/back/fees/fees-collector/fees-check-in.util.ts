import { GameCheckInMode } from '../fees.interface';

export function requiredGameCredits(feesDoubled: boolean): number {
  return feesDoubled ? 2 : 1;
}

export function tournamentUsesDoubledFees(title: string | null | undefined): boolean {
  return (title ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .includes('roy');
}

export function gamerFeePrice(
  isMember: boolean,
  memberPrice: number,
  nonMemberPrice: number,
  feesDoubled: boolean,
): number {
  return (isMember ? memberPrice : nonMemberPrice) * requiredGameCredits(feesDoubled);
}

export function canSelectGameCard(
  gamer: { is_member: boolean; game_credits: number },
  feesDoubled: boolean,
): boolean {
  return gamer.is_member && gamer.game_credits >= requiredGameCredits(feesDoubled);
}

export function checkInState(mode: GameCheckInMode): {
  validated: true;
  enabled: boolean;
  in_euro: boolean;
} {
  return {
    validated: true,
    enabled: mode !== 'none',
    in_euro: mode === 'euro',
  };
}