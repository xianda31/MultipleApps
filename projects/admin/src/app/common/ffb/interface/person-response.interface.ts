/**
 * FFB API V2 Person Response - Direct mapping from FFB V2 /persons/{id} API
 * Contains full person details including license number (ffbId)
 */

export interface PersonResponse {
  id: number;
  migrationId: number;
  address: Address;
  allowContactInDirectory: boolean;
  allowNotificationsCompetitions: boolean;
  allowNotificationsEntities: boolean;
  allowNotificationsResultsEmail: boolean;
  allowNotificationsResultsPush: boolean;
  assignments: Assignment[];
  avatarUrl: string | null;
  bboPseudo: string | null;
  birthdate: string; // ISO 8601
  club: Club;
  clubLicensee: boolean;
  createdAt: string;
  deathSeason: string | null;
  disabledPlayer: boolean;
  eduNatStudent: boolean;
  eduNatTeacher: boolean;
  eLicensee: boolean;
  email: string;
  emailInvalid: boolean;
  emailVerified: boolean;
  ffbId: number; // ← License number (padded to 8 digits)
  firstLicenseDate: string;
  firstName: string;
  forcedIc: number | null;
  forcedIv: number | null;
  forcedPp: number;
  forcedPpEndDate: string | null;
  funbridgePseudo: string | null;
  funbridgeToken: string | null;
  gender: 'M' | 'F';
  industry: LabelValue;
  lastName: string;
  level: number;
  licence: boolean;
  mathLab: boolean;
  nationality: Country;
  newsletterAsDeTrefleDigital: boolean;
  newsletterAsDeTreflePrinted: boolean;
  newsletterBridgeBeginner: boolean;
  newsletterBridgeImprovement: boolean;
  newsletterLicensee: boolean;
  newsletterPro: boolean;
  origin: string | null;
  phone1: Phone;
  phone2: Phone | null;
  previousSchool: string | null;
  pro: boolean;
  realEmail: string | null;
  referee: boolean;
  refereeDiplomas: any[];
  school: string | null;
  season: Season;
  situation: LabelValue;
  spc: LabelValue;
  suspensions: any[];
  teacherDiplomas: any[];
  user: User;
  valid: boolean;
  bestRanking: Ranking;
  hasBeenClubLicensee: boolean;
  hasBeenELicensee: boolean;
  hasBeenLicensee: boolean;
  licensee: boolean;
}

export interface Address {
  invalid: boolean;
  verified: boolean;
  id: number;
  migrationId: number;
  address: string;
  address2: string | null;
  address3: string | null;
  cedex: string | null;
  city: string;
  country: Country;
  latitude: number | null;
  longitude: number | null;
  zipCode: string;
}

export interface Country {
  id: number;
  label: string;
  code: string;
}

export interface Assignment {
  id: number;
}

export interface Club {
  id: number;
  migrationId: number;
  ffbCode: string;
  label: string;
  labelArticle: string | null;
  name: string;
  type: string;
  eGroup: boolean;
  committee: Committee;
  district: any | null;
}

export interface Committee {
  id: number;
  migrationId: number;
  ffbCode: string;
  label: string;
  labelArticle: string;
  name: string;
  type: string;
  league: LeagueZone;
  zone: LeagueZone;
}

export interface LeagueZone {
  id: number;
  migrationId: number;
  ffbCode: string;
  label: string;
  type: 'league' | 'zone';
}

export interface Phone {
  id: number;
  number: string;
  invalid: boolean;
  verified: boolean;
  smsEnabled: boolean;
}

export interface Ranking {
  ic: number;
  iv: number;
  pe: number;
  pec: number;
  pp: number;
  ppc: number;
}

export interface Season {
  id: number;
  category: string;
  charterEthical: string;
  charterHonorability: string;
  charterImages: string;
  fbptAddressSharingConsent: any | null;
  ranking: Ranking;
}

export interface User {
  id: number;
  firebaseUid: string;
  locked: boolean;
  roles: string[];
}

export interface LabelValue {
  code: string;
  label: string;
}
