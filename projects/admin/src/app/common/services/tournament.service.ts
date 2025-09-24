import { Injectable } from '@angular/core';
import { club_tournament } from '../ffb/interface/club_tournament.interface';
import { BehaviorSubject, from, map, merge, Observable, scan, switchMap, tap } from 'rxjs';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { TournamentTeams } from '../ffb/interface/tournament_teams.interface';
import { ToastService } from './toast.service';

@Injectable({
    providedIn: 'root',
})
export class TournamentService {

    private _tournamentTeams: TournamentTeams[] = [];
    private _tournamentTeams$ = new BehaviorSubject<TournamentTeams[]>([]);

    constructor(
        private ffbService: FFB_proxyService,
    private toastService: ToastService
    ) {
    }

    list_next_tournaments(days_back: number): Observable<club_tournament[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start_date = new Date(today);
        start_date.setDate(today.getDate() - days_back);
        return this.ffbService._getTournaments().pipe(
            map((tournaments) => {
                if (!Array.isArray(tournaments)) {
                    this.toastService.showErrorToast('connexion au serveur FFB','Erreur serveur FFB ou format inattendu lors de la récupération des tournois');
                    console.error('Erreur serveur FFB ou format inattendu lors de la récupération des tournois');
                    return [];
                }
                return tournaments.filter((tournament) => new Date(tournament.date) >= start_date);
            }),
            // tap((tournaments) => { this._tournaments = tournaments; })
        );
    }

    list_next_tournament_teams(days_back: number = 0): Observable<TournamentTeams[]> {
        return this.list_next_tournaments(days_back).pipe(
            switchMap((tournaments) => {
                const tournamentTeamsObservables = tournaments.map((tournament) =>
                    from(this.ffbService.getTournamentTeams(tournament.team_tournament_id.toString()))
                );
                return merge(...tournamentTeamsObservables).pipe(
                    tap((t: TournamentTeams) => {
                        const idx = this._tournamentTeams.findIndex(tt => tt.subscription_tournament.id ===
                            t.subscription_tournament.id);
                        if (idx > -1) this._tournamentTeams[idx] = t;
                        else this._tournamentTeams.push(t);

                        this._tournamentTeams.sort((a, b) => {
                            return new Date(this.date_of(a)).getTime() - new Date(this.date_of(b)).getTime();
                        });
                        this._tournamentTeams$.next(this._tournamentTeams);
                    }),
                );
            }),
            switchMap(() => this._tournamentTeams$.asObservable())
        );
    }

    getTournamentTeams(tteams_id: string): Observable<TournamentTeams> {

        return this._tournamentTeams$.asObservable().pipe(
            map((tteams) => {
                if (tteams && tteams.length > 0) {
                    let existingTeams = tteams.find(t => t.subscription_tournament.id.toString() === tteams_id);
                    if (existingTeams) {
                        return (existingTeams);
                    } else { throw new Error(`TournamentTeams with id ${tteams_id} not found in cached data. (1/2)`); }
                } else { throw new Error(`TournamentTeams with id ${tteams_id} not found in cached data. (2/2)`); }
            })
        );
    }


    private find_tournamentTeamsById(tteams_id: string): TournamentTeams | undefined {
        return this._tournamentTeams.find(t => t.subscription_tournament.id.toString() === tteams_id);
    }

    private date_of(tTeams: TournamentTeams): string {
        return tTeams.subscription_tournament.organization_club_tournament.date;
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
                this._tournamentTeams$.next(this._tournamentTeams);
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
                this._tournamentTeams$.next(this._tournamentTeams);
            } catch (error) {
                console.error('Error deleting team:', error);
            }
        }

    }
}
