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

export function hasSameNormalizedNames(
  firstNameA: string | null | undefined,
  lastNameA: string | null | undefined,
  firstNameB: string | null | undefined,
  lastNameB: string | null | undefined,
): boolean {
  const normalizedFirstName = normalizeMemberIdentityName(firstNameA);
  const normalizedLastName = normalizeMemberIdentityName(lastNameA);
  return !!normalizedFirstName
    && !!normalizedLastName
    && normalizedFirstName === normalizeMemberIdentityName(firstNameB)
    && normalizedLastName === normalizeMemberIdentityName(lastNameB);
}

export function hasSameNormalizedMemberName(member: Member, clubMember: ClubMember): boolean {
  return hasSameNormalizedNames(
    member.firstname,
    member.lastname,
    clubMember.firstName,
    clubMember.lastName,
  );
}
