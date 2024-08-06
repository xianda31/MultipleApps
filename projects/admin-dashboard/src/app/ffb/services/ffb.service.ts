import { Injectable } from '@angular/core';
import { get } from 'aws-amplify/api';
import { ffb_teams, ffb_tournament, FFBplayer, FFBTeam, Person } from '../interface/tournament.ffb.interface';

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

  async getTournaments(): Promise<ffb_tournament[]> {
    try {
      const restOperation = get({
        apiName: 'myHttpApi',
        path: 'v1/organizations/1438/club_tournament',
      });
      const { body } = await restOperation.response;
      // console.log('GET call succeeded: ', await body.text());
      const data = await body.json();
      const data2 = data as unknown as ffb_tournament[];
      return data2;
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }

  async getTournamentTeams(id: number): Promise<Person[][]> {
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
      const data = json as unknown as ffb_teams;
      // console.log('GET call succeeded: ', data.teams);
      // ffb_teams { subscription_tournament,teams: FFBTeam[] }
      // FFBTeam { id, players: FFBplayer[] }
      // FFBplayer { id, position, email, firstname, lastname .... person: Person }
      // Person { id, license_number, lastname, firstname,... user: User, iv: Iv, organization: Organization }
      return data.teams.map((team: FFBTeam) => {
        return team.players.map((player: FFBplayer) => {
          return player.person
        })
      });
    } catch (error) {
      console.log('GET call failed: ', error);
      return [];
    }
  }

}
