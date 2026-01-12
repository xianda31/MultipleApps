import { Injectable } from '@angular/core';
import { Competition, CompetitionSeason, CompetitionTeam, Player } from './competitions.interface';

import { CompetitionResultsMap } from './competitions.interface';
import { FFB_proxyService } from '../../common/ffb/services/ffb.service';
import { MembersService } from '../../common/services/members.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { from, map, Observable, catchError, of, switchMap, tap, mergeMap } from 'rxjs';
import { Member } from '../../common/interfaces/member.interface';
import { FileService } from '../../common/services/files.service';

@Injectable({
  providedIn: 'root'
})
export class CompetitionService {
  private _members: Member[] = [];
  private _team_results: CompetitionResultsMap = {};



  constructor(
    private ffbService: FFB_proxyService,
    private memberService: MembersService,
    private systemService: SystemDataService,
    private fileService: FileService
  ) {
    this.memberService.listMembers().subscribe(members => {
      this._members = members;
    });


  }

  getCompetionsResults(season: string): Observable<CompetitionResultsMap> { 

    return from(this.ffbService.getSeasons()).pipe(
      // recupérer la saison correspondant au nom donné
      map((seasons: CompetitionSeason[]) => {
        const selected_season = seasons.find(s => s.name === season);
        return selected_season;
      }),
      // récupère les données des compétitions à partir du fichier S3 si disponible (en série dans la séquence RxJS)
      switchMap((seasonObj: CompetitionSeason | undefined) => {
        if (!seasonObj) return of(seasonObj);
        const safeSeason = season.replace(/\//g, '_');
        return from(this.fileService.download_json_file('any/resultats' + safeSeason + '.txt')).pipe(
          tap((data: any) => {
            this._team_results = data;
          }),
          catchError((err) => {
            this._team_results = {};
            return of(null);
          }),
          map(() => seasonObj)
        );
      }),
      // récupérer les compétitions de cette saison
      switchMap((seasonObj: CompetitionSeason | undefined) => {
        if (!seasonObj) return of([] as Competition[]);
        const competitions = this.getCompetitions(String(seasonObj.id));
        return competitions;
      }),
      // filtrer les compétitions n'etant pas listées dans le fichier S3 et ayant des résultats d'équipe
      map((competitions: Competition[]) => {
        const filtered_comps = competitions.filter(c => !this.is_logged_in_S3(String(c.id)) && c.allGroupsProbated === true);
        // console.log('Nouvelles compétitions avec résultats d\'équipe', filtered_comps);
        return filtered_comps;
      }),
      // récupérer les résultats pour chaque compétition
      switchMap((competitions: Competition[]) => {
        return from(this.runSerial(competitions)).pipe(
          map((results: { [competitionId: number]: { competition: Competition, teams: CompetitionTeam[] } }) => {
            const merged = { ...this._team_results, ...results };
            return merged;
          }),
          tap((merged) => this.saveResults(season, merged)),
        );
      })
    );
  }

  // Exécution séquentielle des requêtes pour chaque compétition
  private async runSerial(competitions: Competition[]): Promise<{ [competitionId: number]: { competition: Competition, teams: CompetitionTeam[] } }> {
    const results: { [competitionId: number]: { competition: Competition, teams: CompetitionTeam[] } } = {};
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
    return results;
  }

  saveResults(season: string, results: CompetitionResultsMap): void {
    const safeSeason = season.replace(/\//g, '_');
    // Ne pas créer le fichier si les résultats sont vides
    if (results && Object.keys(results).length > 0) {
      this.fileService.upload_to_S3(results, 'any/', 'resultats' + safeSeason + '.txt');
    } else {
      console.log('Aucun résultat à sauvegarder, fichier S3 non créé.');
    }
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

  is_logged_in_S3(c_id: string): boolean {
    return this._team_results[Number(c_id)] !== undefined;
  }
  has_a_member(players: Player[]): boolean {
    const member1 = this._members.find(m => players.some(p => p.license_number === m.license_number));
    const member2 = this._members.find(m => players.some(p => p.license_number === m.license_number));
    return member1 !== undefined || member2 !== undefined;
  }

  isMember(player: Player): boolean {
    return this._members.some(m => m.license_number === player.license_number);
  }

}
