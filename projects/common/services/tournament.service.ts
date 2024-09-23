import { Injectable } from '@angular/core';
import { Tournament } from '../ffb/interface/club_tournament.interface';
import { from, Observable, of, tap } from 'rxjs';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { TournamentTeams } from '../ffb/interface/tournament_teams.interface';

@Injectable({
    providedIn: 'root',
})
export class TournamentService {
    private tournaments!: Tournament[];
    private tteams!: TournamentTeams;
    private current_tteam_id!: string;

    constructor(private ffbService: FFB_proxyService) {
    }


    listTournaments(): Observable<Tournament[]> {
        return this.tournaments ? of(this.tournaments) : this.ffbService._getTournaments().pipe(
            tap((tournaments) => { this.tournaments = tournaments; })
        );
    }


    // C(RU)DL Team


    createTeam(tteams_id: string, license_pair: string[]): Promise<TournamentTeams | null> {
        return this.ffbService.postTeam(tteams_id, license_pair)
    }

    deleteTeam(tteams_id: string, team_id: string): Promise<boolean | null> {
        return this.ffbService.deleteTeam(tteams_id, team_id)
    }

    getTeams(tteams_id: string): Observable<TournamentTeams> {
        if (this.current_tteam_id !== tteams_id || !this.tteams) {
            // console.log('consultation FFB ...');
            this.current_tteam_id = tteams_id;
            return from(this.ffbService.getTournamentTeams(tteams_id)).pipe(
                tap((tteams) => this.tteams = tteams)
            );
        } else {
            // console.log('teams already loaded');
            return of(this.tteams);
        }
    }
}