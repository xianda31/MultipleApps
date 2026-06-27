import { Competition, CompetitionOrganization, CompetitionPhases, CompetitionSeason, CompetitionTeam } from '../../../back/competitions/competitions.interface';
import { ClubMember } from '../interface/club-member.interface';
import { Tournament } from '../interface/club_tournament.interface';
import { TournamentTeams } from '../interface/tournament_teams.interface';
import { GroupSession, GroupSessionSearchResponse } from '../interface/group-session.interface';
import { TeamSearchResponse, TeamItem } from '../interface/team-search.interface';
import { PersonResponse } from '../interface/person-response.interface';
import {
  ApiCompetitionDto,
  ApiCompetitionOrganizationDto,
  ApiCompetitionPhasesDto,
  ApiCompetitionSeasonDto,
  ApiCompetitionTeamDto,
  ApiFfbLicenseeDto,
  ApiFfbPlayerDto,
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
    team_tournament_id: asNumber(groupSession.id, 0).toString(),
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

export function toTournamentTeams(payload: unknown): TournamentTeams | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload as unknown as ApiTournamentTeamsDto as unknown as TournamentTeams;
}

export function toTournamentTeamsFromV2(
  payload: unknown,
  groupSessionId: string,
  tournament?: any
): TournamentTeams {
  const response: any = isRecord(payload) ? payload : {};
  const items = asArray<TeamItem>(response.items);
  const pagination = isRecord(response.pagination) ? response.pagination : undefined;

  // Extract metadata from tournament or create defaults
  const date = tournament?.date || '';
  const tournamentName = tournament?.tournament_name || 'Tournament';
  const sessionName = tournament?.session_name || '';
  const time = tournament?.time || '00:00';

  return {
    subscription_tournament: {
      id: asNumber(parseInt(groupSessionId, 10), 0),
      organization_club_tournament: {
        date,
        tournament_name: tournamentName,
        session_name: sessionName,
        time,
      },
    },
    items,
    pagination: pagination
      ? {
          total_pages: asNumber(pagination.total_pages, 1),
          total_items: asNumber(pagination.total_items, items.length),
          current_page: asNumber(pagination.current_page, 1),
        }
      : undefined,
  };
}

/**
 * Extract license_number and player info from FFB V2 /persons/{id} response
 * Used for non-members to get their actual license number
 */
export function toPersonV2(payload: unknown): { license_number: string; firstName: string; lastName: string } | null {
  if (!isRecord(payload)) return null;

  const ffbId = asNumber(payload['ffbId'], 0);
  if (!ffbId) {
    console.warn('[FFB Adapter] toPersonV2: ffbId missing or 0', payload);
    return null;
  }

  return {
    license_number: ffbId.toString().padStart(8, '0'),
    firstName: asString(payload['firstName'], ''),
    lastName: asString(payload['lastName'], '').toUpperCase(),
  };
}
