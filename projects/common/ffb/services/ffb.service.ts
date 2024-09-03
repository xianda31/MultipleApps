import { Injectable } from '@angular/core';
import { del, get, post } from 'aws-amplify/api';
import { club_tournament } from '../interface/club_tournament.interface';
import { FFB_licensee } from '../interface/licensee.interface';
import { FFBplayer } from '../interface/FFBplayer.interface';
import { TournamentTeams } from '../interface/tournament_teams.interface';
@Injectable({
  providedIn: 'root'
})
export class FfbService {

  constructor() { }

  async getLicenceeDetails(search: string) {
    if (search === '') {
      return "";
    }
    try {
      const restOperation = get({
        apiName: 'myHttpApi',
        path: 'v1/search-members',
        options: {
          queryParams: { search: search }
        }
      });
      const { body } = await restOperation.response;
      // console.log('GET call succeeded: ', await body.text());
      const data = await body.json();
      return data;
    } catch (error) {
      console.log('GET call failed: ', error);
      return "";
    }
  }

  async searchPlayersSuchAs(hint: string): Promise<FFBplayer[]> {
    try {
      const restOperation = get({
        apiName: 'myHttpApi',
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

  async getTournaments(): Promise<club_tournament[]> {
    try {
      const restOperation = get({
        apiName: 'myHttpApi',
        path: 'v1/organizations/1438/club_tournament',
      });
      const { body } = await restOperation.response;
      // console.log('GET call succeeded: ', await body.text());
      const data = await body.json();
      const data2 = data as unknown as club_tournament[];
      return data2;
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }

  async getAdherents(): Promise<FFB_licensee[]> {
    try {
      const restOperation = get({
        apiName: 'myHttpApi',
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
        apiName: 'myHttpApi',
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
        apiName: 'myHttpApi',
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
      console.log('DELETE call succeeded: ', restOperation.response);
      return true;
    } catch (error) {
      console.log('DELETE call failed: ', error);
      return null;
    }
  }

  async getTournamentTeams(id: number): Promise<TournamentTeams> {
    // console.log('getTournamentTeams id:', id);
    let promise: Promise<TournamentTeams> = new Promise(async (resolve, reject) => {
      try {
        const restOperation = get({
          apiName: 'myHttpApi',
          path: 'v1/organizations/1438/tournament',
          options: { queryParams: { id: id.toString() } }
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

}
