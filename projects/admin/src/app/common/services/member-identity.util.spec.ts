import { ClubMember } from '../ffb/interface/club-member.interface';
import { Member } from '../interfaces/member.interface';
import { hasSameNormalizedMemberName, normalizeMemberIdentityName } from './member-identity.util';

describe('member identity normalization', () => {
  it('normalizes accents, apostrophes, hyphens and repeated spaces', () => {
    expect(normalizeMemberIdentityName('  Marie-Claire d’Almeida ')).toBe('MARIE CLAIRE D ALMEIDA');
  });

  it('matches equivalent normalized first and last names', () => {
    const member = { firstname: 'Françoise', lastname: 'RAMOS' } as Member;
    const clubMember = { firstName: 'Francoise', lastName: 'Ramos' } as ClubMember;

    expect(hasSameNormalizedMemberName(member, clubMember)).toBeTrue();
  });

  it('does not match empty identities', () => {
    expect(hasSameNormalizedMemberName(
      { firstname: '', lastname: '' } as Member,
      { firstName: '', lastName: '' } as ClubMember,
    )).toBeFalse();
  });
});
