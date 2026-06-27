import { Injectable } from '@angular/core';
import { del, get, post } from 'aws-amplify/api';
import { Tournament } from '../interface/club_tournament.interface';
import { ClubMember } from '../interface/club-member.interface';
import { TournamentTeams } from '../interface/tournament_teams.interface';
import { from, Observable } from 'rxjs';
import { Competition, CompetitionOrganization, CompetitionPhases, CompetitionSeason, CompetitionTeam} from '../../../back/competitions/competitions.interface';
import { FFBPerson } from '../../interfaces/FFBperson.interface';
import { environment } from '../../../../environments/environment';
import {
  toCompetitionList,
  toCompetitionOrganizationList,
  toCompetitionPhases,
  toCompetitionSeason,
  toCompetitionSeasonList,
  toCompetitionTeamList,
  toClubMemberList,
  toFfbPerson,
  toPerson,
  toTournamentList,
  toTournamentTeams,
  toTournamentTeamsFromV2,
} from '../adapters/ffb-api.adapter';

const FFB_ENDPOINTS = {
  memberByPersonId: 'ffb/person',
  memberSearch: 'ffb/persons/search',
  seasons: 'ffb/seasons/current',
  organizations: 'ffb/organizations',
  finalRanking: 'ffb/competition-results',
  phases: 'ffb/competition-phases',
  clubTournaments: 'ffb/club-sessions',
  clubMembers: 'ffb/club-members',
  tournamentTeam: 'ffb/club-team',
} as const;

@Injectable({
  providedIn: 'root'
})
export class FFB_proxyService {

  private readonly API_NAME = 'ffbProxyApi';
  private readonly ffbPathPrefix = (environment as any).ffbProxyPathPrefix || '/ffb';
  private readonly ffbPathOverrides = ((environment as any).ffbProxyPathOverrides || {}) as Record<string, string>;

  constructor() { }

  private buildPath(endpoint: string): string {
    const normalizedEndpoint = endpoint.replace(/^\/+/, '');
    const overridden = this.ffbPathOverrides[normalizedEndpoint];
    if (overridden) {
      return overridden.startsWith('/') ? overridden : `/${overridden}`;
    }

    // If endpoint already starts with 'ffb/', return as-is with leading slash (avoid /ffb/ffb/)
    if (normalizedEndpoint.startsWith('ffb/')) {
      return `/${normalizedEndpoint}`;
    }

    const normalizedPrefix = this.ffbPathPrefix.endsWith('/')
      ? this.ffbPathPrefix.slice(0, -1)
      : this.ffbPathPrefix;
    return `${normalizedPrefix}/${normalizedEndpoint}`;
  }


  async get_player(person_id:number): Promise<FFBPerson | null> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.memberByPersonId),
        options: {
          queryParams: {
            id: person_id.toString()
          }
        }
          });
      const { body } = await restOperation.response;
      const data = await body.json();
      return toPerson(data);
    } catch (error) {
      console.log('GET call failed: ', error);
      return null;

    }
  }


  async searchPlayersSuchAs(hint: string, currentPage: number = 1, maxPerPage: number = 80): Promise<ClubMember[]> {   // VALIDATED
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.memberSearch),
        options: {
          queryParams: {
            name: hint,
            currentPage: String(currentPage),
            maxPerPage: String(maxPerPage)
          }
        }
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
  _getTournaments(dateFrom?: Date, dateTo?: Date): Observable<Tournament[]> {  // VALIDATED
    return from((async () => {
      try {
        console.log('[FFB Service] _getTournaments: fetching group sessions...');
        
        // Load all pages from FFB V2 (paginated response)
        const allTournaments: Tournament[] = [];
        let currentPage = 1;
        let totalPages = 1;
        let totalItems = 0;
        
        while (currentPage <= totalPages) {
          console.log(`[FFB Service] _getTournaments: loading page ${currentPage}/${totalPages}...`);
          
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
            options: {
              queryParams
            }
          });
          
          const { body } = await restOperation.response;
          const payload = await body.json();
          
          // Convert V2 response to tournaments
          const pageTournaments = toTournamentList(payload);
          allTournaments.push(...pageTournaments);
          
          // Extract pagination metadata
          const pagination = (payload as any)?.pagination;
          if (pagination && typeof pagination === 'object') {
            if (currentPage === 1) {
              totalPages = pagination.total_pages || 1;
              totalItems = pagination.total_items || 0;
              console.log(`[FFB Service] Pagination plan: ${totalItems} tournaments in ${totalPages} page(s)`);
            }
            console.log(`[FFB Service] Page ${currentPage}/${totalPages}: got ${pageTournaments.length} items, total so far: ${allTournaments.length}/${totalItems}`);
          } else {
            console.warn(`[FFB Service] No pagination metadata on page ${currentPage}, assuming single page`);
            break;
          }
          
          currentPage++;
        }
        
        console.log(`[FFB Service] _getTournaments complete: fetched ${allTournaments.length} tournaments`);
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
        console.log('[FFB Service] getAdherents: seasonId not provided, fetching current season...');
        const season = await this.getCurrentSeason();
        console.log('[FFB Service] getCurrentSeason response:', season);
        if (season) {
          actualSeasonId = (season as any)?.id || (season as any)?.season_id || '';
          console.log('[FFB Service] Got seasonId:', actualSeasonId);
        }
      }

      console.log('[FFB Service] getAdherents: calling club-members with seasonId:', actualSeasonId);
      
      // Load all pages from FFB V2 (paginated response)
      const allItems: ClubMember[] = [];
      let currentPage = 1;
      let totalPages = 1; // Will be set from first response
      let totalItems = 0;
      let perPage = 80;

      while (currentPage <= totalPages) {
        console.log(`[FFB Service] getAdherents: loading page ${currentPage}/${totalPages}...`);
        const restOperation = get({
          apiName: this.API_NAME,
          path: this.buildPath(FFB_ENDPOINTS.clubMembers),
          options: {
            queryParams: { 
              seasonId: actualSeasonId,
              currentPage: String(currentPage),
              maxPerPage: "80"
            }
          }
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
            console.log(`[FFB Service] Pagination plan: ${totalItems} adherents in ${totalPages} page(s) (${perPage}/page)`);
          }
          console.log(`[FFB Service] Page ${currentPage}/${totalPages}: got ${pageItems.length} items, total so far: ${allItems.length}/${totalItems}`);
        } else {
          // No pagination metadata, something went wrong
          console.warn(`[FFB Service] No pagination metadata on page ${currentPage}`);
          break;
        }
        
        currentPage++;
      }

      console.log(`[FFB Service] getAdherents complete: fetched ${allItems.length}/${totalItems} adherents in ${currentPage - 1} request(s)`);
      return allItems;
    } catch (error) {
      console.error('[FFB Service] getAdherents failed:', error);
      return [];
    }
  }

    async getFFBPerson(id: number): Promise<FFBPerson | null> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.memberByPersonId),
        options: {
          queryParams: {
            id: id.toString()
          }
        }
      });
      const { body } = await restOperation.response;
      // console.log('GET call succeeded: ', await body.text());
      const data = await body.json();
      return toFfbPerson(data);
    } catch (error) {
      console.log('GET call failed: ', error);
      return null;
    }
  }


  async postTeam(groupSessionId: string, licences: string[]): Promise<TournamentTeams | null> {

    let players: { license_number: string, computed_amount: number }[] = [];
    licences.forEach(licence => {
      players.push({ license_number: licence, computed_amount: 0 });
    });
    try {
      console.log(`[FFB Service] postTeam: groupSessionId=${groupSessionId}, players=${licences.join(',')}`);
      const restOperation = post({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.tournamentTeam),
        options: {
          body: { players: players },
          queryParams: {
            groupSessionId: groupSessionId,
            currentPage: '1',
            maxPerPage: '80'
          }
        }
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      console.log(`[FFB Service] postTeam succeeded`);
      return toTournamentTeams(data);
    } catch (error) {
      console.log('POST call failed: ', error);
      return null;
    }
  }

  async deleteTeam(groupSessionId: string, teamId: string): Promise<boolean | null> {
    try {
      console.log(`[FFB Service] deleteTeam: groupSessionId=${groupSessionId}, teamId=${teamId}`);
      const restOperation = del({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.tournamentTeam),
        options: {
          queryParams: {
            groupSessionId: groupSessionId,
            team_id: teamId.toString()
          }
        }
      });
      console.log(`[FFB Service] deleteTeam succeeded`);
      return true;
    } catch (error) {
      console.log('DELETE call failed: ', error);
      return null;
    }
  }

  async getTournamentTeams(groupSessionId: string, tournament?: any): Promise<TournamentTeams> {   // VALIDATED
    try {
      console.log(`[FFB Service] getTournamentTeams: groupSessionId=${groupSessionId}`);
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.tournamentTeam),
        options: { 
          queryParams: { 
            groupSessionId: groupSessionId,
            currentPage: '1',
            maxPerPage: '80'
          } 
        }
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

async getOrganizations() : Promise<CompetitionOrganization[]> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.organizations),
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return toCompetitionOrganizationList(data);
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }

async getCurrentSeason() : Promise<CompetitionSeason | null> {
    try {
      console.log('[FFB Service] getCurrentSeason: calling ffb/seasons/current');
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.seasons),
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      console.log('[FFB Service] getCurrentSeason success:', data);
      return toCompetitionSeason(data);
    } catch (error) {
      console.error('[FFB Service] getCurrentSeason failed:', error);
      return null;
    }
  }

  async getCompetitionOrganizations() : Promise<CompetitionOrganization[]> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.organizations),
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return toCompetitionOrganizationList(data);
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }

  async getCompetitions(season_id: string, organization_id: string) : Promise<Competition[]> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath('ffb/competitions/by-organization/' + organization_id),
        options: {
          queryParams: {
            season_id: season_id,
          }
        }
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return toCompetitionList(data);
    } catch (error) {
      console.log('getCompetitions : GET call failed: ', error);
      return [];
    }
  }

  async getCompetitionResults(competition_id: string, organization_id: string) : Promise<CompetitionTeam[]> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.finalRanking),
        options: {
          queryParams: {
            competition_id: competition_id,
            organization_id: organization_id
          }
        }
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      return toCompetitionTeamList(data);
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }
  async getCompetitionPhases(competition_id: string, organization_id: string) : Promise<CompetitionPhases | null> {
    try {
      const restOperation = get({
        apiName: this.API_NAME,
        path: this.buildPath(FFB_ENDPOINTS.phases),
        options: {
          queryParams: {
            competition_id: competition_id,
            organization_id: organization_id
          }
        }
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
