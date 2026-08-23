export interface IsolatedPlayersResponse {
  items: PlayerEntry[];
  pagination: Pagination;
}

export interface PlayerEntry {
  id: number;
  createdAt: string;
  groupSession: {
    id: number;
  };
  person: IsolatedPlayerPerson;
}

export interface IsolatedPlayerPerson {
  id: number;
  ffbId: number;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
  birthdate: string;
  createdAt: string;
  emailVerified: boolean;
  emailInvalid: boolean;
  licence: boolean;
  licensee: boolean;
  clubLicensee: boolean;
  eLicensee: boolean;
  inLicenseeGracePeriod: boolean;
  pro: boolean;
  referee: boolean;
  valid: boolean;
  firstLicenseDate: string;
  avatarUrl: string | null;
  bboPseudo: string | null;
  funbridgePseudo: string | null;
  funbridgeToken: string | null;
  deathSeason: unknown | null;
  disabledPlayer: unknown | null;
  forcedIc: unknown | null;
  forcedIv: unknown | null;
  forcedPp: number;
  forcedPpEndDate: unknown | null;
  eduNatStudent: boolean;
  eduNatTeacher: boolean;
  mathLab: boolean;
  allowContactInDirectory: boolean;
  allowNotificationsCompetitions: boolean;
  allowNotificationsEntities: boolean;
  allowNotificationsResultsEmail: boolean;
  allowNotificationsResultsPush: boolean;
  newsletterAsDeTrefleDigital: boolean;
  newsletterAsDeTreflePrinted: boolean;
  newsletterBridgeBeginner: boolean;
  newsletterBridgeImprovement: boolean;
  newsletterLicensee: boolean;
  newsletterPro: boolean;
  origin: unknown | null;
  realEmail: string | null;
  migrationId: number;
  user: {
    id: number;
  };
  nationality: {
    id: number;
  };
  industry: CodeLabelPair;
  situation: CodeLabelPair;
  spc: CodeLabelPair;
  season: IsolatedPlayerSeason;
  level: unknown | null;
  assignments: unknown[];
  refereeDiplomas: unknown[];
  teacherDiplomas: unknown[];
  suspensions: unknown[];
}

export interface CodeLabelPair {
  code: string;
  label: string;
}

export interface IsolatedPlayerSeason {
  id: number;
  ranking: IsolatedPlayerRanking;
}

export interface IsolatedPlayerRanking {
  ic: number;
  iv: number;
  pe: number;
  pec: number;
  pp: number;
  ppc: number;
}

export interface Pagination {
  current_page: number;
  has_previous_page: boolean;
  has_next_page: boolean;
  per_page: number;
  total_items: number;
  total_pages: number;
}