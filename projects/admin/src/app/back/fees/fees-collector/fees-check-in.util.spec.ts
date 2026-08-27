import { canSelectGameCard, checkInState, gamerFeePrice, requiredGameCredits, tournamentUsesDoubledFees } from './fees-check-in.util';

describe('fees check-in rules', () => {
  it('requires two credits when fees are doubled', () => {
    expect(requiredGameCredits(false)).toBe(1);
    expect(requiredGameCredits(true)).toBe(2);
  });

  it('detects Roy Rene tournaments and doubles their prices', () => {
    expect(tournamentUsesDoubledFees('Challenge Roy René')).toBeTrue();
    expect(tournamentUsesDoubledFees('Tournoi de régularité')).toBeFalse();
    expect(gamerFeePrice(true, 2, 4, true)).toBe(4);
    expect(gamerFeePrice(false, 2, 4, true)).toBe(8);
  });

  it('only allows solvent members to select a game card', () => {
    expect(canSelectGameCard({ is_member: true, game_credits: 2 }, true)).toBeTrue();
    expect(canSelectGameCard({ is_member: true, game_credits: 1 }, true)).toBeFalse();
    expect(canSelectGameCard({ is_member: false, game_credits: 10 }, false)).toBeFalse();
  });

  it('maps each payment mode to the legacy gamer state', () => {
    expect(checkInState('card')).toEqual({ validated: true, enabled: true, in_euro: false });
    expect(checkInState('euro')).toEqual({ validated: true, enabled: true, in_euro: true });
    expect(checkInState('none')).toEqual({ validated: true, enabled: false, in_euro: false });
  });
});