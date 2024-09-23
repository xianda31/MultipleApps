import { Injectable } from '@angular/core';
import { Tournament } from '../ffb/interface/club_tournament.interface';
import { from, Observable, of, tap } from 'rxjs';
import { FfbService } from '../ffb/services/ffb.service';

@Injectable({
    providedIn: 'root',
})
export class TournamentService {
    private tournaments!: Tournament[];

    constructor(private ffbService: FfbService) {
    }


    listTournaments(): Observable<Tournament[]> {
        const _listTournaments = (): Observable<Tournament[]> => {
            return from(this.ffbService.getTournaments()).pipe(
                tap((tournaments) => {
                    this.tournaments = tournaments;
                })
            );
        }
        return this.tournaments ? of(this.tournaments) : _listTournaments();


    }
}