import { FEE_RATE, GameCheckInMode } from '../fees.interface';

export type TournamentFeeMode = 'summer' | 'standard' | 'standard-doubled';

export function requiredGameCredits(feesDoubled: boolean): number {
  return feesDoubled ? 2 : 1;
}

export function feeModeFromConfiguration(feeRate: FEE_RATE, feesDoubled: boolean): TournamentFeeMode {
  if (feeRate === FEE_RATE.HOLIDAYS) return 'summer';
  return feesDoubled ? 'standard-doubled' : 'standard';
}

export function feeModeConfiguration(mode: TournamentFeeMode): {
  feeRate: FEE_RATE;
  feesDoubled: boolean;
} {
  return {
    feeRate: mode === 'summer' ? FEE_RATE.HOLIDAYS : FEE_RATE.STANDARD,
    feesDoubled: mode === 'standard-doubled',
  };
}

export function tournamentFeeMode(title: string | null | undefined): TournamentFeeMode {
  const normalizedTitle = (title ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (normalizedTitle.includes('ete')) return 'summer';
  return normalizedTitle.includes('roy') ? 'standard-doubled' : 'standard';
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

export function membershipPaymentWarningActive(
  warningMonth: number,
  today: Date = new Date(),
): boolean {
  return membershipPaymentWarningLevel(warningMonth, today) !== null;
}

export function membershipPaymentWarningLevel(
  warningMonth: number,
  today: Date = new Date(),
): 'warning' | 'danger' | null {
  if (!Number.isInteger(warningMonth) || warningMonth < 1 || warningMonth > 12) return null;

  const currentMonth = today.getMonth() + 1;
  const seasonStartYear = currentMonth >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const warningYear = warningMonth >= 7 ? seasonStartYear : seasonStartYear + 1;
  const warningDate = new Date(warningYear, warningMonth - 1, 1);

  if (today < warningDate) return null;

  const dangerDate = new Date(warningYear, warningMonth - 1, 15);
  return today >= dangerDate ? 'danger' : 'warning';
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