import { Injectable } from '@angular/core';
import { Competition, CompetitionSeason, CompetitionTeam } from './competitions.interface';
import { FFB_proxyService } from '../../common/ffb/services/ffb.service';
import { MembersService } from '../../common/services/members.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { from, map, Observable, catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CompetitionService {
  constructor(
    private ffbService: FFB_proxyService,
    private memberService: MembersService,
    private systemService: SystemDataService
  ) { }

  getSeasons(): Observable<CompetitionSeason[]> {
    return from(this.ffbService.getSeasons());
  }

  getCurrentCompetitionSeason(): Observable<CompetitionSeason | null> {
    const current_season = this.systemService.get_today_season();
    return from(this.ffbService.getSeasons()).pipe(
      map(seasons => seasons.find(s => s.name === current_season) || null)
    );
  }

  getCompetitions(seasonId: string): Observable<Competition[]> {
    return from(this.ffbService.getCompetitions(seasonId));
  }

  getCompetitionResults(competitionId: string): Observable<CompetitionTeam[]> {
    return from(this.ffbService.getCompetitionResults(competitionId)).pipe(
      catchError((err) => {
        console.error(`Erreur lors du chargement des résultats pour la compétition ${competitionId}:`, err);
        return of([]);
      })
    );
  }

}
