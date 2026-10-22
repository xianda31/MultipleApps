import { ClubMember } from '../ffb/interface/club-member.interface';
import { Member } from '../interfaces/member.interface';

export function normalizeMemberIdentityName(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/['’\-]/g, ' ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasSameNormalizedMemberName(member: Member, clubMember: ClubMember): boolean {
  const memberFirstName = normalizeMemberIdentityName(member.firstname);
  const memberLastName = normalizeMemberIdentityName(member.lastname);
  const ffbFirstName = normalizeMemberIdentityName(clubMember.firstName);
  const ffbLastName = normalizeMemberIdentityName(clubMember.lastName);
  return !!memberFirstName
    && !!memberLastName
    && memberFirstName === ffbFirstName
    && memberLastName === ffbLastName;
}
