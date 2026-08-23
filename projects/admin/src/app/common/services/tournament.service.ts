import { Injectable } from '@angular/core';
import { club_tournament } from '../ffb/interface/club_tournament.interface';
import { TournamentTeams, Tournament } from '../ffb/interface/tournament.interface';
import { IsolatedPlayersResponse } from '../ffb/interface/isolated-players.interface';
import { BehaviorSubject, from, map, Observable, tap, of, catchError } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { ToastService } from './toast.service';

const TOURNAMENTS_WINDOW = 28; // Days (4 weeks) for searching tournaments

@Injectable({
    providedIn: 'root',
})
export class TournamentService {
    private _tournaments!: Tournament[];
    private _tournamentCache = new Map<string, Tournament[]>();
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

    list_next_tournaments(
        days_back: number,
        tournamentsWindow?: number,
        options: { refresh?: boolean } = { refresh: false }
    ): Observable<Tournament[]> {
        const window = tournamentsWindow || TOURNAMENTS_WINDOW;
        // Calculate date range: (today - days_back) to (today + window)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateFrom = new Date(today);
        dateFrom.setDate(today.getDate() - days_back);
        
        const dateTo = new Date(today);
        dateTo.setDate(today.getDate() + window);

        const cacheKey = `${dateFrom.toISOString().slice(0, 10)}:${dateTo.toISOString().slice(0, 10)}`;
        if (!options.refresh && this._tournamentCache.has(cacheKey)) {
            const cachedTournaments = this._tournamentCache.get(cacheKey)!;
            this._tournaments = cachedTournaments;
            return of(cachedTournaments);
        }

        return this.ffbService._getTournaments(dateFrom, dateTo).pipe(
            map((tournaments: Tournament[]) => {
                if (!Array.isArray(tournaments)) {
                    this.toastService.showError('connexion au serveur FFB', 'Erreur serveur FFB ou format inattendu lors de la récupération des tournois');
                    console.error('Erreur serveur FFB ou format inattendu lors de la récupération des tournois');
                    return [];
                }
                this._tournaments = tournaments;
                this._tournamentCache.set(cacheKey, tournaments);
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
                        return [] as Tournament[];
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

    getTournamentTeams(tteams_id: string, options: { refresh?: boolean } = { refresh: false }): Observable<TournamentTeams> {
        if (!options.refresh) {
            const existing = this.find_tournamentTeamsById(tteams_id);
            if (existing) {
                return of(existing);
            }

            const cached = this._teamFetchCache.get(tteams_id);
            if (cached) {
                return cached;
            }
        }

        const tournament = this._tournaments?.find(item => item.id.toString() === tteams_id);
        const request = from(this.ffbService.getTournamentTeams(tteams_id, tournament)).pipe(
            tap((teams) => {
                const index = this._tournamentTeams.findIndex(
                    item => item.tournament.id === teams.tournament.id
                );
                if (index >= 0) {
                    this._tournamentTeams[index] = teams;
                } else {
                    this._tournamentTeams.push(teams);
                }
                this._tournamentTeams.sort(
                    (left, right) => new Date(this.date_of(left)).getTime() - new Date(this.date_of(right)).getTime()
                );
                this._tournamentTeams$.next(this._tournamentTeams);
            }),
            shareReplay(1)
        );
        this._teamFetchCache.set(tteams_id, request);
        return request;
    }

    getIsolatedPlayers(tteams_id: string): Observable<IsolatedPlayersResponse> {
        return from(this.ffbService.getIsolatedPlayers(tteams_id)).pipe(
            tap((response) => this.updateIsolatedPlayerCount(tteams_id, response.pagination.total_items))
        );
    }

    createIsolatedPlayer(tteams_id: string, personId: number): Promise<boolean> {
        return this.ffbService.postIsolatedPlayer(tteams_id, personId);
    }

    async deleteIsolatedPlayer(tteams_id: string, isolatedPlayerId: number): Promise<boolean> {
        const deleted = await this.ffbService.deleteIsolatedPlayer(isolatedPlayerId);
        if (!deleted) {
            return false;
        }

        const response = await this.ffbService.getIsolatedPlayers(tteams_id);
        this.updateIsolatedPlayerCount(tteams_id, response.pagination.total_items);
        return true;
    }

    private updateIsolatedPlayerCount(tteams_id: string, count: number): void {
        const tournamentTeams = this.find_tournamentTeamsById(tteams_id);
        if (tournamentTeams) {
            tournamentTeams.tournament.isolatedPlayerCount = count;
            this._tournamentTeams$.next(this._tournamentTeams);
            this._teamFetchCache.set(tteams_id, of(tournamentTeams));
        }

        const tournament = this._tournaments?.find((item) => item.id.toString() === tteams_id);
        if (tournament) {
            tournament.isolatedPlayerCount = count;
        }
    }


    private find_tournamentTeamsById(tteams_id: string): TournamentTeams | undefined {
        return this._tournamentTeams.find(t => t.tournament.id.toString() === tteams_id);
    }

    private date_of(tTeams: TournamentTeams): string {
        return tTeams.tournament.date;
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

    async deleteTeam(tteams_id: string, tournamentRegistrationId: string): Promise<boolean> {
        const tteams = this.find_tournamentTeamsById(tteams_id);
        if (!tteams) {
            return false;
        } else {
            try {
                const deleted = await this.ffbService.deleteTeam(tteams_id, tournamentRegistrationId);
                if (!deleted) {
                    return false;
                }
                tteams.items = tteams.items.filter(
                    team => team.tournamentRegistrationId.toString() !== tournamentRegistrationId
                );
                this._tournamentTeams$.next(this._tournamentTeams);
                    // Update cached observable for this tteams_id so future callers get fresh data
                    this._teamFetchCache.set(tteams_id, of(tteams));
                return true;
            } catch (error) {
                console.error('Error deleting team:', error);
                return false;
            }
        }

    }
}
