import { canSelectGameCard, checkInState, gamerFeePrice, membershipPaymentWarningActive, membershipPaymentWarningLevel, requiredGameCredits, tournamentUsesDoubledFees } from './fees-check-in.util';

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

  it('activates the membership warning on the configured month within a July-to-June season', () => {
    expect(membershipPaymentWarningActive(11, new Date(2026, 9, 31, 23, 59))).toBeFalse();
    expect(membershipPaymentWarningActive(11, new Date(2026, 10, 1))).toBeTrue();
    expect(membershipPaymentWarningActive(11, new Date(2027, 5, 30))).toBeTrue();
    expect(membershipPaymentWarningActive(11, new Date(2027, 6, 1))).toBeFalse();
  });

  it('supports warning months in the calendar year following the season start', () => {
    expect(membershipPaymentWarningActive(2, new Date(2027, 0, 31))).toBeFalse();
    expect(membershipPaymentWarningActive(2, new Date(2027, 1, 1))).toBeTrue();
  });

  it('raises the membership warning from warning to danger after the 14th', () => {
    expect(membershipPaymentWarningLevel(11, new Date(2026, 9, 31))).toBeNull();
    expect(membershipPaymentWarningLevel(11, new Date(2026, 10, 1))).toBe('warning');
    expect(membershipPaymentWarningLevel(11, new Date(2026, 10, 14, 23, 59))).toBe('warning');
    expect(membershipPaymentWarningLevel(11, new Date(2026, 10, 15))).toBe('danger');
    expect(membershipPaymentWarningLevel(11, new Date(2027, 5, 30))).toBe('danger');
  });

  it('maps each payment mode to the legacy gamer state', () => {
    expect(checkInState('card')).toEqual({ validated: true, enabled: true, in_euro: false });
    expect(checkInState('euro')).toEqual({ validated: true, enabled: true, in_euro: true });
    expect(checkInState('none')).toEqual({ validated: true, enabled: false, in_euro: false });
  });
});