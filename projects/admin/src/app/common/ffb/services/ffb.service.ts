import { Injectable } from '@angular/core';
import { del, get, post } from 'aws-amplify/api';
import { club_tournament, Tournament } from '../interface/club_tournament.interface';
import { FFB_licensee } from '../interface/licensee.interface';
import { FFBplayer } from '../interface/FFBplayer.interface';
import { TournamentTeams } from '../interface/tournament_teams.interface';
import { from, Observable } from 'rxjs';
import { Competition, CompetitionData, CompetitionOrganization, CompetitionSeason, CompetitionTeam} from '../../../back/competitions/competitions.interface';
@Injectable({
  providedIn: 'root'
})
export class FFB_proxyService {

  constructor() { }


  async searchPlayersSuchAs(hint: string): Promise<FFBplayer[]> {
    try {
      const restOperation = get({
        apiName: 'ffbProxyApi',
        path: 'v1/subscription-search-members',
        options: {
          queryParams: {
            // alive: "1",
            // bbo: "false",
            search: hint
          }
        }
      });
      const { body } = await restOperation.response;
      // console.log('GET call succeeded: ', await body.text());
      const data = await body.json();
      // console.log('searchPlayersSuchAs returned : ', data);
      const data2 = data as unknown as FFBplayer[];
      return data2;
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }
  _getTournaments(): Observable<Tournament[]> {
    const restOperation = get({
      apiName: 'ffbProxyApi',
      path: 'v1/organizations/1438/club_tournament',
    });

    return from((async () => {
      try {
        const response = await restOperation.response;
        if (response.body && response.body.json) {
          return response.body.json() as unknown as Tournament[];
        } else {
          throw new Error('Réponse serveur invalide');
        }
      } catch (error: any) {
        if (error?.response?.statusCode === 500) {
          console.error('Erreur serveur 500 lors de la récupération des tournois');
        } else {
          console.error('Erreur lors de la récupération des tournois:', error);
        }
        return [];
      }
    })());
  }

  // async getTournaments(): Promise<club_tournament[]> {
  //   try {
  //     const restOperation = get({
  //       apiName: 'ffbProxyApi',
  //       path: 'v1/organizations/1438/club_tournament',
  //     });
  //     const { body } = await restOperation.response;
  //     // console.log('GET call succeeded: ', await body.text());
  //     const data = await body.json();
  //     const data2 = data as unknown as club_tournament[];
  //     return data2;
  //   } catch (error) {
  //     console.log('GET call failed: ', error);
  //     return [];
  //   }
  // }

  async getAdherents(): Promise<FFB_licensee[]> {
    try {
      const restOperation = get({
        apiName: 'ffbProxyApi',
        path: 'v1/organizations/1438/members',
      });
      const { body } = await restOperation.response;
      // console.log('GET call succeeded: ', await body.text());
      const data = await body.json();
      const data2 = data as unknown as FFB_licensee[];
      return data2;
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }

  async postTeam(tournamentId: string, licences: string[]): Promise<TournamentTeams | null> {

    let players: { license_number: string, computed_amount: number }[] = [];
    licences.forEach(licence => {
      players.push({ license_number: licence, computed_amount: 0 });
    });
    try {
      const restOperation = post({
        apiName: 'ffbProxyApi',
        path: 'v1/organizations/1438/tournament',
        options: {
          body: { players: players },
          queryParams: {
            id: tournamentId.toString()
          }
        }
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      const data2 = data as unknown as TournamentTeams;;
      return data2;
    } catch (error) {
      console.log('POST call failed: ', error);
      return null;
    }
  }

  async deleteTeam(tournamentId: string, teamId: string): Promise<boolean | null> {
    try {
      const restOperation = del({
        apiName: 'ffbProxyApi',
        path: 'v1/organizations/1438/tournament',
        options: {
          queryParams: {
            id: tournamentId.toString(),
            team_id: teamId.toString()
          }
        }
      });
      // const { body } = await restOperation.response;
      // const data = await body.json();
      // const data2 = data as unknown as TournamentTeams;
      // console.log('DELETE call succeeded: ', restOperation.response);
      return true;
    } catch (error) {
      console.log('DELETE call failed: ', error);
      return null;
    }
  }

  async getTournamentTeams(id: string): Promise<TournamentTeams> {
    // console.log('getTournamentTeams id:', id);
    let promise: Promise<TournamentTeams> = new Promise(async (resolve, reject) => {
      try {
        const restOperation = get({
          apiName: 'ffbProxyApi',
          path: 'v1/organizations/1438/tournament',
          options: { queryParams: { id: id } }
        });
        const { body } = await restOperation.response;
        const json = await body.json();
        const data = json as unknown as TournamentTeams; // was TournamentTeaming
        resolve(data as unknown as TournamentTeams);
      } catch (error) {
        console.log('GET call failed: ', error);
        reject(error);
      }
    });
    return promise;
  }
// API competition

async getOrganizations() : Promise<CompetitionOrganization[]> {
    try {
      const restOperation = get({
        apiName: 'ffbProxyApi',
        path: 'v1/organizations/all',
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      const data2 = data as unknown as CompetitionOrganization[];
      return data2;
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }

async getSeasons() : Promise<CompetitionSeason[]> {
    try {
      const restOperation = get({
        apiName: 'ffbProxyApi',
        path: 'v1/seasons',
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      const data2 = data as unknown as CompetitionSeason[];
      return data2;
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }

  async getCompetitions(season_id: string) : Promise<Competition[]> {
    try {
      const restOperation = get({
        apiName: 'ffbProxyApi',
        path: 'v1/competitions/organizations/1',
        options: {
          queryParams: {
            season_id: season_id,
          }
        }
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      const data2 = data as unknown as Competition[];
      return data2;
    } catch (error) {
      console.log('getCompetitions : GET call failed: ', error);
      return [];
    }
  }

  async getCompetitionResults(competition_id: string) : Promise<CompetitionTeam[]> {
    try {
      const restOperation = get({
        apiName: 'ffbProxyApi',
        path: 'v1/competitions/final-ranking',
        options: {
          queryParams: {
            competition_id: competition_id
          }
        }
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      const data2 = data as unknown as CompetitionTeam[];
      return data2;
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }
  
  async getCompetitionStatus(competition_id: string) : Promise<CompetitionData | null> {
    try {
      const restOperation = get({
        apiName: 'ffbProxyApi',
        path: 'v1/competitions/stades',
        options: {
          queryParams: {
            competition_id: competition_id
          }
        }
      });
      const { body } = await restOperation.response;
      const data = await body.json();
      const data2 = data as unknown as CompetitionData;
      return data2;
    } catch (error) {
      console.log('GET call failed: ', error);
      return null;
    }
  }

}
