import { Injectable } from '@angular/core';
import { Competition, CompetitionData, CompetitionOrganization, CompetitionSeason, CompetitionTeam, Player } from './competitions.interface';

import { CompetitionResultsMap } from './competitions.interface';
import { FFB_proxyService } from '../../common/ffb/services/ffb.service';
import { MembersService } from '../../common/services/members.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { from, map, Observable, catchError, of, switchMap, tap, mergeMap, toArray, concatMap, lastValueFrom } from 'rxjs';
import { Member } from '../../common/interfaces/member.interface';
import { FileService } from '../../common/services/files.service';

@Injectable({
  providedIn: 'root'
})
export class CompetitionService {
  private _members: Member[] = [];
  private _team_results: CompetitionResultsMap = {};
  private _organizations: CompetitionOrganization[] = [];
  private _preferred_organizations: CompetitionOrganization[] = [];

  persistence: boolean = true
  constructor(
    private ffbService: FFB_proxyService,
    private memberService: MembersService,
    private systemService: SystemDataService,
    private fileService: FileService,
  ) {
    this.memberService.listMembers().subscribe(members => {
      this._members = members;
    });
  }

  getCompetitionOrganizations(organization_labels: string[]): Observable<CompetitionOrganization[]> {
    if (this._organizations.length > 0) {
      return of(this._organizations);
    } else {
      return from(this.ffbService.getCompetitionOrganizations()).pipe(
        tap((orgs: CompetitionOrganization[]) => {
          this._organizations = orgs.filter(org => organization_labels.includes(org.label));
        })
      );
    }
  }

  getCompetionsResults(season: string, organization_labels: string[]): Observable<CompetitionResultsMap> {
    return from(this.ffbService.getCompetitionOrganizations()).pipe(
      tap((orgs: CompetitionOrganization[]) => {
        this._preferred_organizations = orgs.filter(org => organization_labels.includes(org.label));
      }),
      switchMap(() => from(this.ffbService.getSeasons())),
      // recupérer la saison correspondant au nom donné
      map((seasons: CompetitionSeason[]) => {
        const selected_season = seasons.find(s => s.name === season);
        return selected_season;
      }),
      // récupère les données des compétitions à partir du fichier S3 si disponible (en série dans la séquence RxJS)
      switchMap((seasonObj: CompetitionSeason | undefined) => {
        if (this.persistence === false) {
          this._team_results = {};
          return of(seasonObj);
        }
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
        return this.getCompetitions(String(seasonObj.id), this._preferred_organizations);
      }),
      // filtre les compétitions de label en 'E '
      map((competitions: Competition[]) => {
        const filtered = competitions.filter(c => !c.label.startsWith('E '));
        console.log('CompetitionService: %s competitions retrieved', filtered.length);
        return filtered;
      }),
      // filtrer les compétitions ayant des résultats d'équipe (allGroupsProbated === true)
      map((competitions: Competition[]) => {
        const filtered = competitions.filter(c => c.allGroupsProbated === true);
        console.log('Compétitions avec résultats d\'équipe', filtered);
        return filtered;
      }),
      // filtrer les compétitions n'ayant pas été enregistrées dans le fichier S3 
      map((competitions: Competition[]) => {
        const filtered = competitions.filter(c => !this.is_logged_in_S3(c));
        console.log('Nouvelles compétitions ', filtered);
        return filtered;
      }),
      // récupérer les résultats pour chaque compétition
      switchMap((competitions: Competition[]) => {
        return from(this.runSerial(competitions)).pipe(
          map((results: CompetitionResultsMap) => {
            console.log('CompetitionService: compétition résultats récupérés', results);
            const merged = { ...this._team_results, ...results };
            return merged;
          }),
          tap((merged) => console.log('CompetitionService: compétition résultats fusionnés', merged)),
          tap((merged) => this.saveResults(season, merged)),
        );
      })
    );
  }

  // Exécution séquentielle des requêtes pour chaque compétition
  private async runSerial(competitions: Competition[]): Promise<CompetitionResultsMap> {
    const results: CompetitionResultsMap = {};
    for (const comp of competitions) {
      const compTeam = await lastValueFrom(this.getCompetitionResults(String(comp.id), String(comp.organization_id)));
      // Filtrer les équipes pour ne garder que celles ayant au moins un membre
      const filteredTeams = (compTeam || []).filter(team => this.has_a_member(team.players));
      // add is_member field to each player
      filteredTeams.forEach(team => {
        team.players.forEach(player => {
          player.is_member = this.isMember(player);
        });
      });
      const safeCompTeam = filteredTeams ?? [];
      // ordonne les équipes membre en premier
      safeCompTeam.sort((a, b) => {
        const aHasMember = this.has_a_member(a.players) ? 0 : 1;
        const bHasMember = this.has_a_member(b.players) ? 0 : 1;
        return aHasMember - bHasMember;
      });
      // trie les joueurs membres en premier dans chaque équipe
      safeCompTeam.forEach(team => {
        team.players.sort((p1, p2) => {
          const m1 = p1.is_member ? 0 : 1;
          const m2 = p2.is_member ? 0 : 1;
          return m1 - m2;
        });
      });
      // if (safeCompTeam.length > 0) {
        if (!results[comp.id]) results[comp.id] = [];
        results[comp.id].push({ competition: comp, teams: safeCompTeam });
      // }
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

  getCompetitions(seasonId: string, organizations: CompetitionOrganization[]): Observable<Competition[]> {
    const organization_ids = organizations.map(org => org.id.toString());
    console.log('Fetching competitions for season', seasonId, 'and organizations', organization_ids);
    return from(organization_ids).pipe(
      concatMap(orgId => from(this.ffbService.getCompetitions(seasonId, orgId))),
      toArray(),
      map(arrays => arrays.flat())
    );
  }

  getCompetitionResults(competitionId: string, organization_id: string): Observable<CompetitionTeam[]> {
    return from(this.ffbService.getCompetitionResults(competitionId, organization_id)).pipe(
      catchError((err) => {
        console.error(`Erreur lors du chargement des résultats pour la compétition ${competitionId}:`, err);
        return of([]);
      })
    );
  }

  is_logged_in_S3(comp: Competition): boolean {
    const c_id = Number(comp.id);
    const c_org = comp.organization_id;
    const resultsArr = this._team_results[c_id];
    if (!resultsArr || !Array.isArray(resultsArr)) return false;
    const isLoggedIn = resultsArr.some(r => r.competition && r.competition.organization_id === c_org);
    console.log(`CompetitionService: is_logged_in_S3 check for competition ${c_id} org ${c_org}:`, isLoggedIn);
    return isLoggedIn;
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
