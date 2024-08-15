import { Injectable } from '@angular/core';
import { get } from 'aws-amplify/api';
import { Team, TournamentTeaming, Player, Person } from '../interface/teams.interface';
import { FFB_tournament } from '../interface/FFBtournament.interface';
import { FFB_licensee } from '../interface/licensee.interface';
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

  async getTournaments(): Promise<FFB_tournament[]> {
    try {
      const restOperation = get({
        apiName: 'myHttpApi',
        path: 'v1/organizations/1438/club_tournament',
      });
      const { body } = await restOperation.response;
      // console.log('GET call succeeded: ', await body.text());
      const data = await body.json();
      const data2 = data as unknown as FFB_tournament[];
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

  async getTournamentTeams(id: number): Promise<Person[][]> {
    // console.log('getTournamentTeams id:', id);
    try {
      const restOperation = get({
        apiName: 'myHttpApi',
        path: 'v1/organizations/1438/tournament',
        options: {
          queryParams: { id: id.toString() }
        }
      });
      const { body } = await restOperation.response;
      const json = await body.json();
      const data = json as unknown as TournamentTeaming;
      // ffb_teams { subscription_tournament,teams: FFBTeam[] }
      // FFBTeam { id, players: FFBplayer[] }
      // FFBplayer { id, position, email, firstname, lastname .... person: Person }
      // Person { id, license_number, lastname, firstname,... user: User, iv: Iv, organization: Organization }
      return data.teams.map((team: Team) => {
        return team.players.map((player: Player) => {
          return player.person
        })
      });
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }

}
