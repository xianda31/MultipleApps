import { Injectable } from '@angular/core';
import { club_tournament, Tournament } from '../ffb/interface/club_tournament.interface';
import { from, map, Observable, of, tap } from 'rxjs';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { TournamentTeams } from '../ffb/interface/tournament_teams.interface';

@Injectable({
    providedIn: 'root',
})
export class TournamentService {
    private _tournaments!: Tournament[];
    private tteams!: TournamentTeams;
    private current_tteam_id!: string;

    constructor(private ffbService: FFB_proxyService) {
    }


    listTournaments(): Observable<Tournament[]> {
        return this._tournaments ? of(this._tournaments) : this.ffbService._getTournaments().pipe(
            tap((tournaments) => { this._tournaments = tournaments; })
        );
    }

    list_next_tournaments(days_back : number): Observable<club_tournament[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start_date = new Date(today);
        start_date.setDate(today.getDate() - days_back);
        return  this.ffbService._getTournaments().pipe(
            map((tournaments) => tournaments.filter((tournament) => new Date(tournament.date) >= start_date)),
            tap((tournaments) => { this._tournaments = tournaments; })
        );
    }

    // C(RU)DL Team


    createTeam(tteams_id: string, license_pair: string[]): Promise<TournamentTeams | null> {
        return this.ffbService.postTeam(tteams_id, license_pair)
    }

    readTeams(tteams_id: string): Observable<TournamentTeams> {
        return from(this.ffbService.getTournamentTeams(tteams_id));
    }

    deleteTeam(tteams_id: string, team_id: string): Promise<boolean | null> {
        return this.ffbService.deleteTeam(tteams_id, team_id)
    }

    getTeams(tteams_id: string): Observable<TournamentTeams> {
        if (this.current_tteam_id !== tteams_id || !this.tteams) {
            this.current_tteam_id = tteams_id;
            return from(this.ffbService.getTournamentTeams(tteams_id)).pipe(
                tap((tteams) => this.tteams = tteams)
            );
        } else {
            return of(this.tteams);
        }
    }
}