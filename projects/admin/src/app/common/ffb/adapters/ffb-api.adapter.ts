import { Competition, CompetitionOrganization, CompetitionPhases, CompetitionSeason, CompetitionTeam, Competition_V2, Entity_V2 } from '../../../back/competitions/competitions.interface';
import { ClubMember } from '../interface/club-member.interface';
import { TournamentV2 } from '../interface/tournament-v2.interface';
import { TournamentTeams } from '../interface/tournament_teams.interface';
import { PersonV2 } from '../interface/person-v2.interface';
import { PersonV2Ranking } from '../interface/person-v2.interface';
import { TeamItem } from '../interface/team-search.interface';
import {
  ApiCompetitionDto,
  ApiCompetitionSearchResponseDto,
  ApiEntitySearchResponseDto,
  ApiCompetitionOrganizationDto,
  ApiCompetitionPhasesDto,
  ApiCompetitionSeasonDto,
  ApiCompetitionTeamDto,
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

function toTournamentV2(raw: unknown): TournamentV2 {
  const groupSession: any = isRecord(raw) ? raw : {};
  const session: any = isRecord(groupSession.session) ? groupSession.session : {};

  // Extract time from ISO date string
  const isoDate = asString(groupSession.date, '');
  const parsedDate = isoDate ? new Date(isoDate) : null;
  const hasValidDate = parsedDate !== null && !Number.isNaN(parsedDate.getTime());
  const time = hasValidDate
    ? `${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}`
    : '00:00';

  return {
    id: asNumber(groupSession.id, 0),
    date: isoDate,
    title: asString(session.label, 'Tournoi'),
    entryCount: asNumber(groupSession.entryCount, 0),
    moment: asString(groupSession.moment, ''),
    location: asString(groupSession.location, ''),
    maxTeamCount: asNumber(groupSession.maxTeamCount, 0),
    expectedBoardCount: asNumber(groupSession.expectedBoardCount, 0),
    time,
  };
}

/**
 * Convert FFB V2 paginated GroupSession response to minimal TournamentV2[] interface
 * Handles: { items: GroupSession[], pagination: {...} }
 */
export function toTournamentV2List(payload: unknown): TournamentV2[] {
  const boxedPayload: any = isRecord(payload) ? payload : {};
  const items = asArray<unknown>(boxedPayload.items);
  return items.map((item: unknown) => toTournamentV2(item));
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

export function toCompetitionListFromSearchResponse(payload: unknown): Competition_V2[] {
  const maybeItems = isRecord(payload) ? (payload as Record<string, unknown>)['items'] : [];
  const items = asArray<any>(maybeItems);

  return items.map((item: any) => {
    const competition = isRecord(item?.competition) ? item.competition : {};
    const division = isRecord(item?.division) ? item.division : {};
    return {
      label: asString(competition?.label, ''),
      division: {
        label: asString(division?.label, 'Aucune Division'),
      },
    } satisfies Competition_V2;
  });
}

export function toCompetitionListFromSearchResponseLegacy(payload: unknown): Competition[] {
  const maybeItems = isRecord(payload) ? (payload as Record<string, unknown>)['items'] : [];
  const items = asArray<any>(maybeItems);

  return items.map((item: any) => {
    const division = isRecord(item?.division) ? item.division : {};
    const competition = isRecord(item?.competition) ? item.competition : {};

    return {
      id: asNumber(item?.id, 0),
      label: asString(item?.label, ''),
      season_id: 0,
      previous_season_id: null,
      pe_bonus_process_duration: null,
      pe_bonus_process_enabled: false,
      simultaneous_code: null,
      organization_id: 0,
      division: {
        id: asNumber(division?.id, 0),
        label: asString(division?.label, 'Aucune Division'),
      },
      calculation_date: null,
      family: {
        id: asNumber(competition?.id, 0),
        label: asString(competition?.label, ''),
        is_ko: false,
      },
      type: {
        id: 0,
        label: 'Fédérale',
        code: 'federal',
      },
      format: {
        id: 0,
        label: '',
        code: '',
      },
      festival: null,
      archive_date: null,
      allGroupsProbated: false,
      subscription_type: null,
      is_paid: false,
      billing_date: null,
      billing_docdate: null,
      nb_phases: 0,
      nb_simultaneous_phases: 0,
    } as Competition;
  });
}

export function toEntityV2List(payload: unknown): Entity_V2[] {
  const boxedPayload: ApiEntitySearchResponseDto | Record<string, unknown> = isRecord(payload)
    ? (payload as Record<string, unknown>)
    : { items: [] };
  const items = asArray<any>((boxedPayload as any).items);

  return items.map((item: any) => ({
    label: asString(item?.label, ''),
    id: asNumber(item?.id, 0),
    type: asString(item?.type, 'zone') as Entity_V2['type'],
  }));
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
  
  // Normalize fields and compute license_number from ffbId
  return members.map((member: any) => ({
    ...member,
    license_number: asNumber(member.ffbId, 0).toString().padStart(8, '0'),
    firstName: capitalize(asString(member.firstName, '').trim()),
    lastName: asString(member.lastName, '').trim().toUpperCase(),
    gender: asString(member.gender, '').trim(),
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
  const tournamentName = asString(
    tournament?.title,
    asString(tournament?.description,
    asString(tournament?.tournament_name, asString(tournament?.session_name, ''))
    )
  );
  const sessionName = asString(tournament?.session_name, asString(tournament?.title, asString(tournament?.description, '')));
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
 * Extract person info from FFB V2 /ffb/person response
 */
export function toPersonV2(payload: unknown): PersonV2 | null {
  if (!isRecord(payload)) return null;

  const ffbId = asNumber(payload['ffbId'], 0);
  if (!ffbId) {
    console.warn('[FFB Adapter] toPersonV2: ffbId missing or 0', payload);
    return null;
  }

  const address: any = isRecord(payload['address']) ? payload['address'] : {};
  const phone1: any = isRecord(payload['phone1']) ? payload['phone1'] : null;
  const season: any = isRecord(payload['season']) ? payload['season'] : {};
  const ranking: any = isRecord(season['ranking']) ? season['ranking'] : null;

  const personRanking: PersonV2Ranking | null = ranking
    ? {
        ic: asNumber(ranking['ic'], 0),
        iv: asNumber(ranking['iv'], 0),
        pe: asNumber(ranking['pe'], 0),
        pec: asNumber(ranking['pec'], 0),
        pp: asNumber(ranking['pp'], 0),
        ppc: asNumber(ranking['ppc'], 0),
      }
    : null;

  return {
    license_number: ffbId.toString().padStart(8, '0'),
    firstName: asString(payload['firstName'], ''),
    lastName: asString(payload['lastName'], '').toUpperCase(),
    email: asString(payload['email'], ''),
    address: asString(address['address'], ''),
    city: asString(address['city'], ''),
    phone: phone1 ? asString(phone1['number'], '') : null,
    seasonCategory: asString(season['category'], ''),
    ranking: personRanking,
  };
}
