import { Competition, CompetitionOrganization, CompetitionPhases, CompetitionSeason, CompetitionTeam } from '../../../back/competitions/competitions.interface';
import { FFBPerson } from '../../interfaces/FFBperson.interface';
import { ClubMember } from '../interface/club-member.interface';
import { FFBplayer } from '../interface/FFBplayer.interface';
import { Tournament } from '../interface/club_tournament.interface';
import { Person, TournamentTeams } from '../interface/tournament_teams.interface';
import {
  ApiCompetitionDto,
  ApiCompetitionOrganizationDto,
  ApiCompetitionPhasesDto,
  ApiCompetitionSeasonDto,
  ApiCompetitionTeamDto,
  ApiFfbLicenseeDto,
  ApiFfbPersonDto,
  ApiFfbPlayerDto,
  ApiPersonDto,
  ApiTournamentDto,
  ApiTournamentTeamsDto,
} from '../contracts/ffb-api.contracts';

function asArray<T>(payload: unknown): T[] {
  return Array.isArray(payload) ? (payload as T[]) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Capitalize text: uppercase first letter after each space or dash.
 * Handles compound names and accents (François, Jean-Claude, Marie France)
 */
function capitalize(text: string): string {
  if (!text) return text;
  return text
    .toLowerCase()
    .split(/(\s+|-)/g)  // Split while preserving delimiters
    .map(part => /^[\s-]+$/.test(part) ? part : (part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function toLegacyTournamentFromV2GroupSession(raw: unknown): Tournament {
  const groupSession: any = isRecord(raw) ? raw : {};
  const session: any = isRecord(groupSession.session) ? groupSession.session : {};
  const group: any = isRecord(groupSession.group) ? groupSession.group : {};
  const phase: any = isRecord(group.phase) ? group.phase : {};
  const stade: any = isRecord(phase.stade) ? phase.stade : {};
  const organization: any = isRecord(stade.organization) ? stade.organization : {};

  const isoDate = asString(groupSession.date, '');
  const parsedDate = isoDate ? new Date(isoDate) : null;
  const hasValidDate = parsedDate !== null && !Number.isNaN(parsedDate.getTime());
  const time = hasValidDate
    ? `${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}`
    : '00:00';

  const entryCount = asNumber(groupSession.entryCount, 0);
  const expectedBoardCount = asNumber(groupSession.expectedBoardCount, 0);
  const maxTeamCount = asNumber(groupSession.maxTeamCount, 0);
  const organizationId = asNumber(organization.id, 1438);
  const sessionId = session.id;

  return {
    id: asNumber(groupSession.id, 0),
    organization_id: organizationId,
    date: isoDate,
    moment_id: 0,
    tournament_name: asString(groupSession.description, asString(session.label, 'Tournoi')),
    max_teams: maxTeamCount,
    tournament_place_type_id: 0,
    tournament_type_id: 0,
    time,
    computed_amount: 0,
    tournament_status: 0,
    is_loaded: true,
    type_code: asString(session.format, ''),
    session_id: sessionId ?? null,
    player_count: entryCount,
    session_name: asString(session.label, ''),
    session_access_key: '',
    deputy_director_access_key: asString(groupSession.deputyDirectorAccessKey, ''),
    director_access_key: asString(groupSession.directorAccessKey, ''),
    target_link: null,
    nb_deal: expectedBoardCount,
    iv_player_max: 0,
    droped_target_link: null,
    edulib_students_group_id: null,
    vimeo_id: null,
    is_halftime: false,
    nb_round: 0,
    date_end: null,
    description: groupSession.description ?? null,
    mail_sent: null,
    moment_code: asString(groupSession.moment, ''),
    moment_label: asString(groupSession.moment, ''),
    type_id: '',
    type_label: asString(session.rankingScoringType, ''),
    place_id: '',
    place_code: asString(groupSession.location, ''),
    place_label: asString(groupSession.location, ''),
    tournament_place_id: 0,
    tournament_place_code: asString(groupSession.location, ''),
    tournament_place_label: asString(groupSession.location, ''),
    tournament_type_code: asString(session.format, ''),
    tournament_type_label: asString(session.format, ''),
    referee_id: 0,
    deputy_referee_1_id: null,
    deputy_referee_2_id: null,
    referee_license_number: '',
    referee_firstname: '',
    referee_lastname: '',
    deputy_referee_1_license_number: null,
    deputy_referee_1_firstname: null,
    deputy_referee_1_lastname: null,
    deputy_referee_2_license_number: null,
    deputy_referee_2_firstname: null,
    deputy_referee_2_lastname: null,
    simultaneous_label: null,
    simultaneous_moment: null,
    simultaneous_code: null,
    simultaneous_tournament_id: null,
    team_tournament_id: sessionId ? String(sessionId) : '',
    nbr_inscrit: entryCount,
    has_isolated_player: false,
    paid_amount: 0,
    DUPexists: false,
  };
}

export function toTournamentList(payload: unknown): Tournament[] {
  if (Array.isArray(payload)) {
    return asArray<ApiTournamentDto>(payload).map((dto) => ({ ...dto })) as Tournament[];
  }

  const boxedPayload: any = payload;
  if (isRecord(payload) && Array.isArray(boxedPayload?.items)) {
    return boxedPayload.items.map((item: unknown) => toLegacyTournamentFromV2GroupSession(item));
  }

  return [];
}

export function toCompetitionSeasonList(payload: unknown): CompetitionSeason[] {
  return asArray<ApiCompetitionSeasonDto>(payload).map((dto) => ({ ...dto })) as CompetitionSeason[];
}

export function toCompetitionSeason(payload: unknown): CompetitionSeason | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload as unknown as ApiCompetitionSeasonDto as unknown as CompetitionSeason;
}

export function toCompetitionOrganizationList(payload: unknown): CompetitionOrganization[] {
  return asArray<ApiCompetitionOrganizationDto>(payload).map((dto) => ({ ...dto })) as CompetitionOrganization[];
}

export function toCompetitionList(payload: unknown): Competition[] {
  return asArray<ApiCompetitionDto>(payload) as unknown as Competition[];
}

export function toCompetitionTeamList(payload: unknown): CompetitionTeam[] {
  return asArray<ApiCompetitionTeamDto>(payload) as unknown as CompetitionTeam[];
}

export function toCompetitionPhases(payload: unknown): CompetitionPhases | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload as unknown as ApiCompetitionPhasesDto as unknown as CompetitionPhases;
}

export function toFfbPlayerList(payload: unknown): FFBplayer[] {
  return asArray<ApiFfbPlayerDto>(payload) as unknown as FFBplayer[];
}

/**
 * Extract ClubMembers from FFB V2 paginated API response
 * FFB V2 returns { items: ClubMember[], pagination: {...} }
 * No transformation needed - ClubMember structure matches API response exactly
 */
export function toClubMemberList(payload: unknown): ClubMember[] {
  // Handle FFB V2 paginated response: { items: ClubMember[], pagination: {...} }
  let members: ClubMember[] = [];
  if (isRecord(payload) && Array.isArray((payload as any).items)) {
    members = asArray<ClubMember>((payload as any).items);
  } else {
    members = asArray<ClubMember>(payload);
  }
  
  // Normalize: pad ffbId to 8 digits and clean up whitespace in text fields
  return members.map((member: any) => ({
    ...member,
    firstName: capitalize(asString(member.firstName, '').trim()),
    lastName: asString(member.lastName, '').trim().toUpperCase(),
    gender: asString(member.gender, '').trim(),
    // Store padded license number for consistent matching with DB Member.license_number
    license_number_padded: asNumber(member.ffbId, 0).toString().padStart(8, '0'),
  }));
}

export function toFfbPerson(payload: unknown): FFBPerson | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload as unknown as ApiFfbPersonDto as unknown as FFBPerson;
}

export function toPerson(payload: unknown): Person | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload as unknown as ApiPersonDto as unknown as Person;
}

export function toTournamentTeams(payload: unknown): TournamentTeams | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload as unknown as ApiTournamentTeamsDto as unknown as TournamentTeams;
}
