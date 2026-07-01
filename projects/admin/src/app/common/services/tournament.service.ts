import { Injectable } from '@angular/core';
import { club_tournament } from '../ffb/interface/club_tournament.interface';
import { TournamentV2 } from '../ffb/interface/tournament-v2.interface';
import { BehaviorSubject, from, map, merge, Observable, scan, switchMap, tap, of, catchError, throwError } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { TournamentTeams } from '../ffb/interface/tournament_teams.interface';
import { ToastService } from './toast.service';

const MAX_TOURNAMENTS_LISTED = 8; // Number of tournaments to list
const TOURNAMENTS_WINDOW = 28; // Days (4 weeks) for searching tournaments

@Injectable({
    providedIn: 'root',
})
export class TournamentService {
    private _tournaments!: TournamentV2[];
    private _tournamentTeams: TournamentTeams[] = [];
    private _tournamentTeams$ = new BehaviorSubject<TournamentTeams[]>([]);
    // Cache for in-flight or resolved TournamentTeams observables to avoid repeated remote calls
    private _teamFetchCache: Map<string, Observable<TournamentTeams>> = new Map();

    constructor(
        private ffbService: FFB_proxyService,
        private toastService: ToastService
    ) {
    }

    private isFfbMaintenanceError(err: any): boolean {
        if (!err) return false;

        const status = err?.statusCode || err?.$metadata?.httpStatusCode || err?.response?.statusCode;
        const raw = `${err?.name || ''} ${err?.message || ''} ${err?.toString?.() || ''}`.toLowerCase();

        // Amplify can surface upstream 503 as UnknownError with very little detail.
        return status === 503 || raw.includes('503') || raw.includes('service unavailable') || raw.includes('unknownerror');
    }

    list_next_tournaments(days_back: number, tournamentsWindow?: number): Observable<TournamentV2[]> {
        const window = tournamentsWindow || TOURNAMENTS_WINDOW;
        // Calculate date range: (today - days_back) to (today + window)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateFrom = new Date(today);
        dateFrom.setDate(today.getDate() - days_back);
        
        const dateTo = new Date(today);
        dateTo.setDate(today.getDate() + window);

        // Always fetch from API to ensure data reflects current window parameters
        return this.ffbService._getTournaments(dateFrom, dateTo).pipe(
            map((tournaments: TournamentV2[]) => {
                if (!Array.isArray(tournaments)) {
                    this.toastService.showError('connexion au serveur FFB', 'Erreur serveur FFB ou format inattendu lors de la récupération des tournois');
                    console.error('Erreur serveur FFB ou format inattendu lors de la récupération des tournois');
                    return [];
                }
                this._tournaments = tournaments;
                return this._tournaments;
            }),
            catchError((err: any) => {
                console.warn('[TournamentService] Erreur lors de la récupération des tournois', err);
                return from(this.ffbService.checkAlive()).pipe(
                    map((health) => {
                        const maintenanceDetected = health.maintenance || (!health.alive && this.isFfbMaintenanceError(err));
                        if (maintenanceDetected) {
                            this.toastService.showError(
                                'FFB en maintenance',
                                'ffbridge.fr est actuellement en maintenance (HTTP 503). Les tournois sont temporairement indisponibles.'
                            );
                        } else {
                            this.toastService.showError(
                                'Tournois FFB indisponibles',
                                'Le service FFB est temporairement indisponible. Réessaie dans quelques minutes.'
                            );
                        }
                        return [] as TournamentV2[];
                    }),
                    catchError(() => {
                        if (this.isFfbMaintenanceError(err)) {
                            this.toastService.showError(
                                'FFB en maintenance',
                                'ffbridge.fr est actuellement en maintenance (HTTP 503). Les tournois sont temporairement indisponibles.'
                            );
                        } else {
                            this.toastService.showError(
                                'Tournois FFB indisponibles',
                                'Le service FFB est temporairement indisponible. Réessaie dans quelques minutes.'
                            );
                        }
                        return of([]);
                    })
                );
            })
        );
    }

    list_next_tournament_teams(days_back: number = 0): Observable<TournamentTeams[]> {


        return this.list_next_tournaments(days_back).pipe(
            switchMap((tournaments) => {
                let filtered_tournaments = tournaments
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .slice(0, MAX_TOURNAMENTS_LISTED); // Ne prendre que les 8 premiers

                const tournamentTeamsObservables = filtered_tournaments.map((tournament) => {
                    const groupSessionId = tournament.id.toString();
                    // If we already have the teams in memory, emit them synchronously
                    const existing = this.find_tournamentTeamsById(groupSessionId);
                    if (existing) return of(existing as TournamentTeams);

                    // If a fetch is already in-flight or cached, reuse it
                    if (this._teamFetchCache.has(groupSessionId)) return this._teamFetchCache.get(groupSessionId)!;

                    // Otherwise initiate remote fetch and cache the observable (shareReplay to replay result)
                    const obs = from(this.ffbService.getTournamentTeams(groupSessionId, tournament)).pipe(
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
                    this._teamFetchCache.set(groupSessionId, obs);
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

    async createTeam(tteams_id: string, player_pair: number[]): Promise<void> {
        try {
            if (player_pair.length !== 2 || player_pair.some(id => !Number.isFinite(id))) {
                console.warn(`[TournamentService] createTeam: Exactly 2 valid player IDs are required`);
                this.toastService.showError('Création d\'équipe', 'Une équipe doit contenir exactement 2 joueurs valides');
                return;
            }

            if (player_pair[0] === player_pair[1]) {
                this.toastService.showError('Création d\'équipe', 'Les deux joueurs doivent être différents');
                return;
            }

            const success = await this.ffbService.postTeam(tteams_id, player_pair);
            if (success) {
                // Reload teams from FFB API to get fresh data
                const freshTeams = await this.ffbService.getTournamentTeams(tteams_id);
                const tteams = this.find_tournamentTeamsById(tteams_id);
                if (tteams && freshTeams) {
                    tteams.items = freshTeams.items;
                    this._tournamentTeams$.next(this._tournamentTeams);
                    // Update cached observable for this tteams_id so future callers get fresh data
                    this._teamFetchCache.set(tteams_id, of(tteams));
                }
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
                tteams.items = tteams.items.filter(team => team.id.toString() !== team_id);
                this._tournamentTeams$.next(this._tournamentTeams);
                    // Update cached observable for this tteams_id so future callers get fresh data
                    this._teamFetchCache.set(tteams_id, of(tteams));
            } catch (error) {
                console.error('Error deleting team:', error);
            }
        }

    }
}
