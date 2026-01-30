
import { Injectable } from '@angular/core';
import { Competition, COMPETITION_DIVISION_LABELS, COMPETITION_LEVELS, CompetitionOrganization, CompetitionSeason, CompetitionTeam, Player } from './competitions.interface';

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

  COMPETITION_LEVELS = COMPETITION_LEVELS;

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

  /**
   * Accepts only the object structure { comite, ligue, national }.
   * Converts to array for internal use.
   */
  getCompetitionOrganizations(organization_labels: { comite: string; ligue: string; national: string }): Observable<CompetitionOrganization[]> {
        let labels: string[];
        if (organization_labels && typeof organization_labels === 'object') {
          labels = [organization_labels[this.COMPETITION_LEVELS.National], organization_labels[this.COMPETITION_LEVELS.Ligue], organization_labels[this.COMPETITION_LEVELS.Comite]];
        } else {
          labels = ['FFB', 'Ligue 06 LR-PY', 'Comité des Pyrenees'];
        }
        if (labels.some(l => l === undefined)) {
          console.warn('Attention: une des valeurs preferred_organizations est undefined', labels);
        } else {
          // console.log('Labels utilisés pour organisations:', labels);
        }
    if (this._organizations.length > 0) {
      const foundLabels = this._organizations.map(org => org.label);
      labels.forEach(label => {
        if (!foundLabels.includes(label)) {
          console.warn(`Organisation non trouvée pour le label: ${label}`);
        }
      });
      return of(this._organizations);
    } else {
      return from(this.ffbService.getCompetitionOrganizations()).pipe(
        tap((orgs: CompetitionOrganization[]) => {
          this._organizations = orgs.filter(org => labels.includes(org.label));
          const foundLabels = this._organizations.map(org => org.label);
          labels.forEach(label => {
            if (!foundLabels.includes(label)) {
              console.warn(`Organisation non trouvée pour le label: ${label}`);
              console.warn('Organisations disponibles:', orgs.map(o => o.label));
            }
          });
        })
      );
    }
  }

    /**
   * Calcule le label de division rendu pour une compétition selon la logique initiale (voir getDivisionCategory)
   */
   getDivisionCategoryToLabel(competition: Competition): string {
    // Si la compétition est de la famille Interclubs, on retourne explicitement 'Interclubs'
    if (competition.family && competition.family.label === 'Interclubs') {
      return 'Interclubs';
    }
    let labelToUse = competition.division.label;
    if (labelToUse === 'Aucune Division' && competition.label) {
      labelToUse = competition.label;
    }
    const division_labels = COMPETITION_DIVISION_LABELS;
    const key = Object.keys(division_labels).find(k => labelToUse.startsWith(k));
    if (!key) {
      return 'Autres';
    }
    return division_labels[key] || 'Autres';
  }

  getCompetionsResults(
    season: string,
    organization_labels: { comite: string; ligue: string; national: string },
    full_regeneration: boolean 
  ): Observable<CompetitionResultsMap> {
    let labels: string[];
    if (organization_labels && typeof organization_labels === 'object') {
      labels = [organization_labels[COMPETITION_LEVELS.National], organization_labels[COMPETITION_LEVELS.Ligue], organization_labels[COMPETITION_LEVELS.Comite]];
    } else {
      labels = ['FFB', 'Ligue 06 LR-PY', 'Comité des Pyrénées'];
    }
    if (labels.some(l => l === undefined)) {
      console.warn('Attention: une des valeurs preferred_organizations est undefined', labels);
    } else {
    }
    return (from(this.ffbService.getCompetitionOrganizations()).pipe(
      tap((orgs: CompetitionOrganization[]) => {
        this._preferred_organizations = orgs.filter(org => labels.includes(org.label));
      }),
      switchMap(() => from(this.ffbService.getSeasons())),
      // recupérer la saison correspondant au nom donné
      map((seasons: CompetitionSeason[]) => {
        const selected_season = seasons.find(s => s.name === season);
        return selected_season;
      }),
      // récupère les données des compétitions à partir du fichier S3 si disponible (en série dans la séquence RxJS)
      switchMap((seasonObj: CompetitionSeason | undefined) => {
        if (full_regeneration === true) {
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
      // filtres regroupés en un seul map
      map((competitions: Competition[]) => {
        const filtered = competitions
          .filter(c => !c.label.startsWith('E '))
          .filter(c => c.type.label === 'Fédérale')
          .filter(c => c.allGroupsProbated === true)
          .filter(c => !this.is_logged_in_S3(c));
        // console.log('Nouvelles compétitions non encore persistées ', filtered);
        return filtered;
      }),
      // récupérer les résultats pour chaque compétition
      switchMap((competitions: Competition[]) => {
        return from(this.runSerial(competitions) as Promise<CompetitionResultsMap>).pipe(
          map((results: CompetitionResultsMap) => {
            // console.log('CompetitionService: compétition résultats récupérés', results);
            const merged = { ...this._team_results, ...results };
            return merged;
          }),
          // tap((merged) => console.log('CompetitionService: compétition résultats fusionnés', merged)),
          tap((merged) => this.saveResults(season, merged)),
        );
      })
    )) as Observable<CompetitionResultsMap>;
  }

  // Exécution séquentielle des requêtes pour chaque compétition
  private async runSerial(competitions: Competition[]): Promise<CompetitionResultsMap> {
    const results: CompetitionResultsMap = {};
    for (const comp of competitions) {
      // Injecte le assigned_division selon la logique initiale
      comp.assigned_division = this.getDivisionCategoryToLabel(comp);
      comp.assigned_label = comp.assigned_division === 'Interclubs' ? comp.label :comp.family.label;
      let compTeam = await lastValueFrom(this.getCompetitionResults(String(comp.id), String(comp.organization_id)));
      // compute pe_pourcerntage for each player
      compTeam = this.computePePercentage(comp, compTeam);

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
      if (!results[comp.id]) results[comp.id] = [];
      results[comp.id].unshift({ competition: comp, teams: safeCompTeam });
    }
    console.log('CompetitionService: résultats des compétitions nouvellement calculés ', results);
    return results;
  }

  private computePePercentage(comp: Competition, teams: CompetitionTeam[]): CompetitionTeam[] {
    // Somme totale des PE distribués à toutes les équipes (tous joueurs)
    const totalPe = teams.reduce((sum, team) => {
      return sum + team.players.reduce((s, player) => s + (player.pe || 0) + (player.pe_bonus || 0) + (player.pe_extra || 0), 0);
    }, 0);
    comp.cumulated_pe_percentage = totalPe;
    // Calculer le pe de chaque équipe
    const teamPeArray = teams.map(team => team.players.reduce((s, player) => s + (player.pe || 0) + (player.pe_bonus || 0) + (player.pe_extra || 0), 0));
      // Pour chaque équipe, calculer le % de PE attribués et cumulated_pe_percentage (somme des PE de l'équipe et de toutes les équipes mieux classées)
      return teams.map((team, idx) => {
        const teamPe = teamPeArray[idx];
        team.pe_pourcentage = totalPe > 0 ? (teamPe / totalPe) * 100 : 0;
        // cumulated_pe_percentage = somme des PE gagnés par l'équipe et toutes les équipes de rang supérieur (i.e. d'indice <= idx)
        team.cumulated_pe_percentage = totalPe > 0 ? (teamPeArray.slice(0, idx + 1).reduce((sum, pe) => sum + pe, 0) / totalPe) * 100 : 0;
        return team;
      });
  }

  saveResults(season: string, results: CompetitionResultsMap): void {
    const safeSeason = season.replace(/\//g, '_');
    // Ne pas créer le fichier si les résultats sont vides
    if (results && Object.keys(results).length > 0) {
      // console.log('résultats : ', results);
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
    // console.log('Fetching competitions for season', seasonId, 'and organizations', organization_ids);
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
    // console.log(`CompetitionService: is_logged_in_S3 check for competition ${c_id} org ${c_org}:`, isLoggedIn);
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
