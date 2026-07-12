import { MemberGender } from '../interfaces/member.interface';

export function normalizeGender(value: unknown): MemberGender {
  if (value === null || value === undefined) return 'U';

  if (typeof value === 'number') {
    if (value === 1) return 'M';
    if (value === 0 || value === 2) return 'F';
    return 'U';
  }

  const raw = String(value).trim().toUpperCase();

  if (raw === 'M' || raw === 'M.' || raw === 'MONSIEUR' || raw === 'H' || raw === 'HOMME' || raw === '1') {
    return 'M';
  }
  if (raw === 'F' || raw === 'MME' || raw === 'MADAME' || raw === 'FEMME' || raw === '0' || raw === '2') {
    return 'F';
  }

  return 'U';
}

export function isFemaleGender(value: unknown): boolean {
  return normalizeGender(value) === 'F';
}
