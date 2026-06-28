/**
 * FFB API V2 ClubMember - Direct mapping from FFB V2 /persons/search API response
 * Represents a member of a club as returned by FFB V2 API (RGPD compliant)
 * No email/phone data (RGPD-protected), sourced elsewhere if needed
 */

export interface ClubMember {
  id: number;
  license_number: string;    // ffbId padded to 8 digits (computed by adapter)
  firstName: string;
  lastName: string;
  gender: "M" | "F" | string;
  birthdate: string;         // ISO8601
  club: ClubInfo;
  licensee: boolean;
  eLicensee: boolean;
  season: SeasonInfo;
  mainRegistration: RegistrationInfo;
}

export interface ClubInfo {
  id: number;
  ffbCode: string;
  name: string;
  label: string;
  committee: Committee;
  type: string;
}

export interface Committee {
  id: number;
  label: string;
  zone: Zone;
}

export interface Zone {
  id: number;
  label: string;
}

export interface SeasonInfo {
  id: number;
  category: string; // e.g., "senior", "junior", "minibridge"
  ranking?: Ranking;
}

export interface Ranking {
  ic?: number;
  iv?: number;
  pe?: number;
  pp?: number;
  [key: string]: number | undefined;
}

export interface RegistrationInfo {
  free: boolean;
  createdAt?: string; // ISO8601
  [key: string]: any;
}
