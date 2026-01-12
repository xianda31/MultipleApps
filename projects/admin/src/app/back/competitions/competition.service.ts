import { Injectable } from '@angular/core';
import { Competition, CompetitionSeason, CompetitionTeam, Player } from './competitions.interface';
import { FFB_proxyService } from '../../common/ffb/services/ffb.service';
import { MembersService } from '../../common/services/members.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { from, map, Observable, catchError, of, switchMap } from 'rxjs';
import { Member } from '../../common/interfaces/member.interface';

@Injectable({
  providedIn: 'root'
})
export class CompetitionService {
 members: Member[] = [];


  constructor(
    private ffbService: FFB_proxyService,
    private memberService: MembersService,
    private systemService: SystemDataService
  ) { 
  this.memberService.listMembers().subscribe(members => {
      this.members = members;
    });

  }
  // team_results: { [competitionId: number]: CompetitionTeam[] } = {};

getCompetionsResults(season: string): Observable<{ [competitionId: number]: {competition: Competition, teams: CompetitionTeam[]} }> {
    return from(this.ffbService.getSeasons()).pipe(
      // recupérer la saison correspondant au nom donné
      map((seasons: CompetitionSeason[]) => {
        console.log('Saisons disponibles:', seasons);
        const selected_season = seasons.find(s => s.name === season);
        console.log('Saison sélectionnée:', selected_season);
        return selected_season;
      }),
      // récupérer les compétitions de cette saison
      switchMap((season: CompetitionSeason | undefined) => {
        if (!season) return of([]);
        const   competitions = this.getCompetitions(String(season.id));
        return competitions;
      }),
      // filtrer les compétitions ayant des résultats d'équipe
      map((competitions: Competition[]) => {
        console.log('Compétitions pour la saison', competitions);
        const filtered_comps = competitions.filter(c => c.allGroupsProbated === true);
        console.log('Compétitions filtrées avec résultats d\'équipe', filtered_comps);
        return filtered_comps;
      }),
      
      // récupérer les résultats pour chaque compétition
      switchMap((competitions: Competition[]) => {
        if (!competitions || competitions.length === 0) return of({});
        const results: { [competitionId: number]: { competition: Competition, teams: CompetitionTeam[] } } = {};
        // Exécution séquentielle des requêtes
        const runSerial = async () => {
          for (const comp of competitions) {
            const compTeam = await this.getCompetitionResults(String(comp.id)).toPromise();

            // Filtrer les équipes pour ne garder que celles ayant au moins un membre
            const filteredTeams = (compTeam || []).filter(team => this.has_a_member(team.players));
            // add is_member field to each player
            filteredTeams.forEach(team => {
              team.players.forEach(player => {
                player.is_member = this.isMember(player);
              });
            });
            const safeCompTeam = filteredTeams ?? [];
            results[comp.id] = { competition: comp, teams: safeCompTeam };
          }
        };
        return from(runSerial()).pipe(
          map(() => results)
        );
      })
    );
  }


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

    has_a_member(players: Player[]): boolean {
      const member1 = this.members.find(m => players.some(p => p.license_number === m.license_number));
      const member2 = this.members.find(m => players.some(p => p.license_number === m.license_number));
      return member1 !== undefined || member2 !== undefined;
    }
  
    isMember(player: Player): boolean {
      return this.members.some(m => m.license_number === player.license_number);
    }

}
