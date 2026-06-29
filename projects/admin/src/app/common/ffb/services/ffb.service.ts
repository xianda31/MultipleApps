import { Injectable } from '@angular/core';
import { del, get, post } from 'aws-amplify/api';
import { TournamentV2 } from '../interface/tournament-v2.interface';
import { PersonV2 } from '../interface/person-v2.interface';
import { ClubMember } from '../interface/club-member.interface';
import { TournamentTeams } from '../interface/tournament_teams.interface';
import { from, Observable } from 'rxjs';
import { Competition, CompetitionOrganization, CompetitionPhases, CompetitionSeason, CompetitionTeam } from '../../../back/competitions/competitions.interface';
import { environment } from '../../../../environments/environment';
import { SystemDataService } from '../../services/system-data.service';
import {
  toCompetitionList,
  toCompetitionOrganizationList,
  toCompetitionPhases,
  toCompetitionSeason,
  toCompetitionSeasonList,
  toCompetitionTeamList,
  toClubMemberList,
  toTournamentV2List,
  toTournamentTeamsFromV2,
  toPersonV2,
} from '../adapters/ffb-api.adapter';

const FFB_ENDPOINTS = {
  person: '/api/ffb/v2/person',
  memberSearch: '/api/ffb/v2/persons/search',
  seasons: '/api/ffb/v2/seasons/current',
  organizations: '/api/ffb/v2/organizations',
  finalRanking: '/api/ffb/v2/competition-results',
  phases: '/api/ffb/v2/competition-phases',
  clubTournaments: '/api/ffb/v2/club-sessions',
  clubMembers: '/api/ffb/v2/club-members',
  tournamentTeam: '/api/ffb/v2/club-team',
  teamCreate: '/api/ffb/v2/entries/groupSessions',
  teamEntries: '/api/ffb/v2/entries/team-entries',
} as const;

@Injectable({
  providedIn: 'root'
})
export class FFB_proxyService {

  private readonly API_NAME = 'ffbProxyApi';
  private readonly ffbPathOverrides = ((environment as any).ffbProxyPathOverrides || {}) as Record<string, string>;

  constructor(private systemDataService: SystemDataService) { }

  private getTraceHeaders(): Record<string, string> {
    let traceMode = false;
    try {
      traceMode = !!this.systemDataService.trace_on();
    } catch {
      traceMode = false;
    }
    return { 'x-trace-mode': traceMode ? 'true' : 'false' };
  }

  private withTraceHeaders<T extends Record<string, any>>(options?: T): T & { headers: Record<string, string> } {
    const mergedHeaders = {
      ...(options?.['headers'] || {}),
      ...this.getTraceHeaders(),
    };
    return {
      ...(options || {}),
      ['headers']: mergedHeaders,
    } as T & { headers: Record<string, string> };
  }

  private buildPath(endpoint: string): string {
    const overridden = this.ffbPathOverrides[endpoint];
    if (overridden) {
      return overridden.startsWith('/') ? overridden : `/${overridden}`;
    }
    // Endpoint already contains full path with namespace prefix
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  }



  async searchPlayersSuchAs(hint: string, currentPage: number = 1, maxPerPage: number = 80): Promise<ClubMember[]> {   // VALIDATED
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.memberSearch),
        options: this.withTraceHeaders({
          queryParams: {
            name: hint,
            currentPage: String(currentPage),
            maxPerPage: String(maxPerPage)
          }
        })
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      // FFB V2 returns { items: [...], pagination: {...} } - same format as club-members
      return toClubMemberList(data);
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }
  _getTournaments(dateFrom?: Date, dateTo?: Date): Observable<TournamentV2[]> {  // VALIDATED - returns V2 native interface
    return from((async () => {
      try {
        // Load all pages from FFB V2 (paginated response)
        const allTournaments: TournamentV2[] = [];
        let currentPage = 1;
        let totalPages = 1;
        let totalItems = 0;

        while (currentPage <= totalPages) {
          const queryParams: Record<string, string> = {
            currentPage: String(currentPage),
            maxPerPage: '80'
          };

          // Add date filters if provided
          if (dateFrom) {
            queryParams['dateFrom'] = this.formatDateYYYYMMDD(dateFrom);
          }
          if (dateTo) {
            queryParams['dateTo'] = this.formatDateYYYYMMDD(dateTo);
          }

          const restOperation = get({
            apiName: this.API_NAME,
            path: this.buildPath(FFB_ENDPOINTS.clubTournaments),
            options: this.withTraceHeaders({
              queryParams
            })
          });

          const { body } = await restOperation.response;
          const payload = await body.json();

          // Convert V2 response to minimal TournamentV2 interface
          const pageTournaments = toTournamentV2List(payload);
          allTournaments.push(...pageTournaments);

          // Extract pagination metadata
          const pagination = (payload as any)?.pagination;
          if (pagination && typeof pagination === 'object') {
            if (currentPage === 1) {
              totalPages = pagination.total_pages || 1;
              totalItems = pagination.total_items || 0;
            }
          } else {
            break;
          }

          currentPage++;
        }

        return allTournaments;
      } catch (error: any) {
        console.error('[FFB Service] _getTournaments failed:', error);
        return Promise.reject(error);
      }
    })());
  }

  async getAdherents(seasonId?: string): Promise<ClubMember[]> {              // VALIDATED
    try {
      // In FFB V2, seasonId is required for club-members endpoint
      let actualSeasonId = seasonId || '';
      if (!actualSeasonId) {
        const season = await this.getCurrentSeason();
        if (season) {
          actualSeasonId = (season as any)?.id || (season as any)?.season_id || '';
        }
      }

      // Load all pages from FFB V2 (paginated response)
      const allItems: ClubMember[] = [];
      let currentPage = 1;
      let totalPages = 1; // Will be set from first response
      let totalItems = 0;
      let perPage = 80;

      while (currentPage <= totalPages) {
        const restOperation = get({
          apiName: this.API_NAME,
          path: this.buildPath(FFB_ENDPOINTS.clubMembers),
          options: this.withTraceHeaders({
            queryParams: {
              seasonId: actualSeasonId,
              currentPage: String(currentPage),
              maxPerPage: "80"
            }
          })
        });
        const { body } = await restOperation.response;
        const data = await body.json();

        // FFB V2 returns { items: [...], pagination: {...} }
        const pageItems = toClubMemberList(data);
        allItems.push(...pageItems);

        // Extract pagination metadata
        const pagination = (data as any)?.pagination;
        if (pagination && typeof pagination === 'object') {
          // First request: capture total pages, total items, and per_page info
          if (currentPage === 1) {
            totalPages = pagination.total_pages || 1;
            totalItems = pagination.total_items || 0;
            perPage = pagination.per_page || 80;
          }
        } else {
          // No pagination metadata, something went wrong
          break;
        }

        currentPage++;
      }

      return allItems;
    } catch (error) {
      console.error('[FFB Service] getAdherents failed:', error);
      return [];
    }
  }

  async getFFBPerson(id: number): Promise<PersonV2 | null> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.person),
        options: this.withTraceHeaders({
          queryParams: {
            personId: id.toString()
          }
        })
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      const person = toPersonV2(data);
      return person;
    } catch (error) {
      console.error(`[FFB Service] getFFBPerson failed for person ${id}:`, error);
      return null;
    }
  }


  /**
   * POST team with players to FFB V2 createTeam endpoint
   * URL: https://api-lancelot.ffbridge.fr/entries/groupSessions/{groupSessionId}/createTeam
   * Payload: { players: [personId1, personId2, ...], captainId: personId }
   * personIds are numeric FFB person identifiers (from member.person_id field)
   */
  async postTeam(groupSessionId: string, personIds: number[]): Promise<boolean> {  // VALIDATED
    if (!groupSessionId) {
      return false;
    }
    if (!personIds || personIds.length === 0) {
      return false;
    }

    const captainId = personIds[0]; // First player is captain
    const playersAsNumbers = personIds;

    try {

      const restOperation = post({
        apiName: this.API_NAME,
        path: this.buildPath(`${FFB_ENDPOINTS.teamCreate}/${groupSessionId}/createTeam`),
        options: this.withTraceHeaders({
          body: {
            players: playersAsNumbers,
            captainId: captainId
          }
        })
      });
      const { body } = await restOperation.response;
      await body.json(); // Consume response but don't use it
      return true;
    } catch (error) {
      console.error('[FFB Service] postTeam failed: ', error);
      return false;
    }
  }

  /**
   * DELETE team from FFB V2 API
   * URL: https://api-lancelot.ffbridge.fr/entries/team-entries/{teamId}
   * groupSessionId parameter kept for backward compatibility but not used in V2 API
   */
  async deleteTeam(groupSessionId: string, teamId: string): Promise<boolean | null> {   // VALIDATED
    if (!teamId) {
      return null;
    }
    try {
      const restOperation = del({
        apiName: this.API_NAME,
        path: this.buildPath(`${FFB_ENDPOINTS.teamEntries}/${teamId}`),
        options: this.withTraceHeaders()
      });
      await restOperation.response; // Wait for response to complete
      return true;
    } catch (error) {
      console.error('[FFB Service] deleteTeam failed: ', error);
      return null;
    }
  }

  async getTournamentTeams(groupSessionId: string, tournament?: any): Promise<TournamentTeams> {   // VALIDATED
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.tournamentTeam),
        options: this.withTraceHeaders({
          queryParams: {
            groupSessionId: groupSessionId,
            currentPage: '1',
            maxPerPage: '80'
          }
        })
      });
      const { body } = await restOperation.response;
      const json = await body.json();

      // Convert V2 TeamSearchResponse to TournamentTeams with session metadata
      return toTournamentTeamsFromV2(json, groupSessionId, tournament);
    } catch (error) {
      console.log('GET tournament teams failed: ', error);
      throw error;
    }
  }


  
  // API competition

  async getOrganizations(): Promise<CompetitionOrganization[]> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.organizations),
        options: this.withTraceHeaders(),
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return toCompetitionOrganizationList(data);
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }

  async getCurrentSeason(): Promise<CompetitionSeason | null> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.seasons),
        options: this.withTraceHeaders(),
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return toCompetitionSeason(data);
    } catch (error) {
      console.error('[FFB Service] getCurrentSeason failed:', error);
      return null;
    }
  }

  async getCompetitionOrganizations(): Promise<CompetitionOrganization[]> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.organizations),
        options: this.withTraceHeaders(),
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return toCompetitionOrganizationList(data);
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }

  async getCompetitions(season_id: string, organization_id: string): Promise<Competition[]> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath('/api/ffb/v2/competitions/by-organization/' + organization_id),
        options: this.withTraceHeaders({
          queryParams: {
            season_id: season_id,
          }
        })
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return toCompetitionList(data);
    } catch (error) {
      console.log('getCompetitions : GET call failed: ', error);
      return [];
    }
  }

  async getCompetitionResults(competition_id: string, organization_id: string): Promise<CompetitionTeam[]> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.finalRanking),
        options: this.withTraceHeaders({
          queryParams: {
            competition_id: competition_id,
            organization_id: organization_id
          }
        })
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return toCompetitionTeamList(data);
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }
  async getCompetitionPhases(competition_id: string, organization_id: string): Promise<CompetitionPhases | null> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.phases),
        options: this.withTraceHeaders({
          queryParams: {
            competition_id: competition_id,
            organization_id: organization_id
          }
        })
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return toCompetitionPhases(data);
    } catch (error) {
      console.log('GET call failed: ', error);
      return null;
    }
  }

  private formatDateYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

}
