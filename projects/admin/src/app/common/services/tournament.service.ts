import { Injectable } from '@angular/core';
import { club_tournament, Tournament } from '../ffb/interface/club_tournament.interface';
import { BehaviorSubject, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { TournamentTeams } from '../ffb/interface/tournament_teams.interface';

@Injectable({
    providedIn: 'root',
})
export class TournamentService {
    // private _tournaments!: Tournament[];
    // private tteams!: TournamentTeams;
    // private tteams$!: BehaviorSubject<TournamentTeams>;
    // private current_tteam_id!: string;


    private _tournamenttTeams: TournamentTeams[] = [];
    private _tournamenttTeams$ = new BehaviorSubject<TournamentTeams[]>([]);

    constructor(private ffbService: FFB_proxyService) {
    }


    // listTournaments(): Observable<Tournament[]> {
    //     return this._tournaments ? of(this._tournaments) : this.ffbService._getTournaments().pipe(
    //         tap((tournaments) => { this._tournaments = tournaments; })
    //     );
    // }

    list_next_tournaments(days_back: number): Observable<club_tournament[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start_date = new Date(today);
        start_date.setDate(today.getDate() - days_back);
        return this.ffbService._getTournaments().pipe(
            map((tournaments) => tournaments.filter((tournament) => new Date(tournament.date) >= start_date)),
            // tap((tournaments) => { this._tournaments = tournaments; })
        );
    }

    list_next_tournament_teams(days_back: number): Observable<TournamentTeams[]> {
        return this.list_next_tournaments(days_back).pipe(
            switchMap((tournaments) => {
                const tournamentTeamsObservables = tournaments.map((tournament) => {
                    return this.ffbService.getTournamentTeams(tournament.team_tournament_id.toString());
                });
                return from(Promise.all(tournamentTeamsObservables));
            }),
            switchMap((teamsArray) => {
                this._tournamenttTeams = teamsArray;
                this._tournamenttTeams$.next(this._tournamenttTeams);
                return this._tournamenttTeams$.asObservable();
            })
        );
    }

    getTournamentTeams(tteams_id: string): Observable<TournamentTeams> {

        return this._tournamenttTeams$.asObservable().pipe(
            map((tteams) => {
                if (tteams && tteams.length > 0) {
                    let existingTeams = tteams.find(t => t.subscription_tournament.id.toString() === tteams_id);
                    if (existingTeams) {
                        return (existingTeams);
                    } else { throw new Error(`TournamentTeams with id ${tteams_id} not found in cached data.`); }
                } else { throw new Error(`TournamentTeams with id ${tteams_id} not found in cached data.`); }
            })
        );
    }


    private find_tournamentTeamsById(tteams_id: string): TournamentTeams | undefined {
        return this._tournamenttTeams.find(t => t.subscription_tournament.id.toString() === tteams_id);
    }


    // C(RU)DL Team


    async createTeam(tteams_id: string, license_pair: string[]): Promise<void> {
        try {
            const new_tteams = await this.ffbService.postTeam(tteams_id, license_pair);
            const tteams = this.find_tournamentTeamsById(tteams_id);
            if (tteams && new_tteams) {
                tteams.teams = new_tteams.teams;
                // update the isolated player count , anticipating FFB update
                tteams.isolated_player_count = tteams.teams.reduce((acc, team) => {
                    return acc + (team.players.length === 1 ? 1 : 0);
                }, 0);
                this._tournamenttTeams$.next(this._tournamenttTeams);
            }
        } catch (error) {
            console.error('Error creating team:', error);
        }
    }

    readTeams(tteams_id: string): Observable<TournamentTeams> {
        return from(this.ffbService.getTournamentTeams(tteams_id));
    }

    async deleteTeam(tteams_id: string, team_id: string): Promise<void> {
        const tteams = this.find_tournamentTeamsById(tteams_id);
        if (!tteams) {
            throw new Error(`TournamentTeams with id ${tteams_id} not found in cached data.`);
        } else {
            try {
                await this.ffbService.deleteTeam(tteams_id, team_id);
                tteams.teams = tteams.teams.filter(team => team.id.toString() !== team_id);
                // update the isolated player count , anticipating FFB update
                tteams.isolated_player_count = tteams.teams.reduce((acc, team) => {
                    return acc + (team.players.length === 1 ? 1 : 0);
                }, 0);
                this._tournamenttTeams$.next(this._tournamenttTeams);
            } catch (error) {
                console.error('Error deleting team:', error);
            }
        }

    }

    // private remote_loadTeams(tteams_id: string): Observable<TournamentTeams> {
    //     return from(this.ffbService.getTournamentTeams(tteams_id)).pipe(
    //         tap((tteams) => {
    //             this.tteams = tteams;
    //             this.tteams$ = new BehaviorSubject<TournamentTeams>(tteams);
    //             // this.tteams$.next(tteams);
    //         }),
    //         switchMap(() => this.tteams$.asObservable())
    //     );
    // }

    // getTeams(tteams_id: string): Observable<TournamentTeams> {
    //     const force_reload = (this.current_tteam_id !== tteams_id || !this.tteams);

    //     return force_reload ? this.remote_loadTeams(tteams_id) : this.tteams$.asObservable();
    // }
}
