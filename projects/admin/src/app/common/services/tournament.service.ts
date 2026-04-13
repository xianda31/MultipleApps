import { Injectable } from '@angular/core';
import { club_tournament } from '../ffb/interface/club_tournament.interface';
import { BehaviorSubject, from, map, merge, Observable, scan, switchMap, tap, of, catchError, throwError } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { TournamentTeams } from '../ffb/interface/tournament_teams.interface';
import { ToastService } from './toast.service';

const MAX_TOURNAMENTS_LISTED = 8; // Number of tournaments to list

@Injectable({
    providedIn: 'root',
})
export class TournamentService {
    private _tournaments!: club_tournament[];
    private _tournamentTeams: TournamentTeams[] = [];
    private _tournamentTeams$ = new BehaviorSubject<TournamentTeams[]>([]);
    // Cache for in-flight or resolved TournamentTeams observables to avoid repeated remote calls
    private _teamFetchCache: Map<string, Observable<TournamentTeams>> = new Map();

    constructor(
        private ffbService: FFB_proxyService,
        private toastService: ToastService
    ) {
    }

    list_next_tournaments(days_back: number): Observable<club_tournament[]> {
        let remote_load$ = this.ffbService._getTournaments().pipe(
            map((tournaments: unknown) => {
                if (!Array.isArray(tournaments)) {
                    this.toastService.showError('connexion au serveur FFB', 'Erreur serveur FFB ou format inattendu lors de la récupération des tournois');
                    console.error('Erreur serveur FFB ou format inattendu lors de la récupération des tournois');
                    return [];
                }
                this._tournaments = tournaments as club_tournament[];
                return this._tournaments;
            }),
            catchError((err: any) => {
                console.warn('[TournamentService] Erreur lors de la récupération des tournois', err);
                return throwError(() => err);
            })
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start_date = new Date(today);
        start_date.setDate(today.getDate() - days_back);

        return this._tournaments ?
            from([this._tournaments.filter((tournament: club_tournament) => new Date(tournament.date) >= start_date)]) : remote_load$.pipe(
                map((tournaments: club_tournament[]) => tournaments.filter((tournament: club_tournament) => new Date(tournament.date) >= start_date))
            );
    }

    list_next_tournament_teams(days_back: number = 0): Observable<TournamentTeams[]> {


        return this.list_next_tournaments(days_back).pipe(
            switchMap((tournaments) => {
                let filtered_tournaments = tournaments
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .slice(0, MAX_TOURNAMENTS_LISTED); // Ne prendre que les 8 premiers

                const tournamentTeamsObservables = filtered_tournaments.map((tournament) => {
                    const id = tournament.team_tournament_id.toString();
                    // If we already have the teams in memory, emit them synchronously
                    const existing = this.find_tournamentTeamsById(id);
                    if (existing) return of(existing as TournamentTeams);

                    // If a fetch is already in-flight or cached, reuse it
                    if (this._teamFetchCache.has(id)) return this._teamFetchCache.get(id)!;

                    // Otherwise initiate remote fetch and cache the observable (shareReplay to replay result)
                    const obs = from(this.ffbService.getTournamentTeams(id)).pipe(
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
                        shareReplay(1)
                    );
                    this._teamFetchCache.set(id, obs);
                    return obs;
                });

                return merge(...tournamentTeamsObservables);
            }),
            switchMap(() => this._tournamentTeams$.asObservable()),
            catchError((err) => throwError(() => err))
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
                    // Update cached observable for this tteams_id so future callers get fresh data
                    this._teamFetchCache.set(tteams_id, of(tteams));
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
                    // Update cached observable for this tteams_id so future callers get fresh data
                    this._teamFetchCache.set(tteams_id, of(tteams));
            } catch (error) {
                console.error('Error deleting team:', error);
            }
        }

    }
}
