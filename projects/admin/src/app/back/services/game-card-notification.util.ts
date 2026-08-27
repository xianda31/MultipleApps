export type GameCardNotification = 'none' | 'low-credit' | 'card-exhausted' | 'all-exhausted';

export function determineGameCardNotification(
  exhaustedCardCount: number,
  creditAfter: number,
  effectiveCreditBefore: number,
  effectiveCreditAfter: number,
  lowCreditThreshold: number,
): GameCardNotification {
  if (exhaustedCardCount > 0) {
    return creditAfter === 0 ? 'all-exhausted' : 'card-exhausted';
  }
  return effectiveCreditBefore > lowCreditThreshold && effectiveCreditAfter <= lowCreditThreshold
    ? 'low-credit'
    : 'none';
}