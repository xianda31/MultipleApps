
import { Injectable } from '@angular/core';
import { Competition, COMPETITION_DIVISION_LABELS, COMPETITION_LEVELS, CompetitionOrganization, CompetitionSeason, CompetitionTeam, Player, CompetitionPhases } from './competitions.interface';

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
  private _memberLoaded = false;
  private _memberPromise: Promise<void>;

  COMPETITION_LEVELS = COMPETITION_LEVELS;

  constructor(
    private ffbService: FFB_proxyService,
    private memberService: MembersService,
    private systemService: SystemDataService,
    private fileService: FileService,
  ) {
    // Create a promise that resolves when members are loaded
    this._memberPromise = new Promise<void>((resolve) => {
      this.memberService.listMembers().subscribe(
        members => {
          if (!members || !Array.isArray(members)) {
            console.error(`❌ CompetitionService [ERROR] listMembers() returned non-array`);
            this._members = [];
          } else {
            this._members = members;
          }
          this._memberLoaded = true;
          resolve();
        },
        error => {
          console.error(`❌ CompetitionService [ERROR] members loading failed:`, error);
          this._members = [];
          this._memberLoaded = true;
          resolve();
        }
      );
    });
  }

  /**
   * Ensure members are loaded before processing
   */
  private async ensureMembersLoaded(): Promise<void> {
    if (this._memberLoaded) {
      if (!this._members || this._members.length === 0) {
        console.error(`❌ CompetitionService [ERROR] Members not loaded properly`);
      }
      return;
    }
    
    await this._memberPromise;
    
    if (!this._members || this._members.length === 0) {
      console.error(`❌ CompetitionService [ERROR] Members failed to load`);
    }
  }
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
   * Calcule  pour une compétition sla catégorie en se basant sur :
   * - la famille de la compétition (ex: Interclubs)
   * - la division de la compétition (ex: Division de Ligue, Expert, Performance, Challenge, Espérance)
   * - le label de la compétition (en dernier recours si division = "Aucune Division")
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
    const norm = (s: string | undefined) => (s || '').normalize('NFD').replace(/[[\u0300-\u036f]/g, '').toLowerCase();
    // normalize labelToUse once
    const nLabel = norm(labelToUse);
    const key = Object.keys(division_labels).find(k => {
      const val = division_labels[k];
      // match if labelToUse starts with the key (abbrev), or equals the mapped value,
      // or starts with the mapped value (e.g. "Division de Ligue")
      return nLabel.startsWith(norm(k)) || norm(val) === nLabel || nLabel.startsWith(norm(val));
    });
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
      // CRITICAL: Ensure members are loaded BEFORE filtering teams
      switchMap((competitions: Competition[]) => {
        return from(this.ensureMembersLoaded()).pipe(
          map(() => competitions)
        );
      }),
      // filtres regroupés en un seul map
      map((competitions: Competition[]) => {
        const filtered = competitions
          .filter(c => !c.label.startsWith('E '))
          .filter(c => c.type.label === 'Fédérale')
          .filter(c => c.allGroupsProbated === true)
          .filter(c => !this.is_logged_in_S3(c));
        return filtered;
      }),
      // récupérer les résultats pour chaque compétition
      switchMap((competitions: Competition[]) => {
        return from(this.runSerial(competitions) as Promise<CompetitionResultsMap>).pipe(
          map((results: CompetitionResultsMap) => {
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
      // Appelle la méthode combinée qui renvoie teams + phases
      const payload = await lastValueFrom(this.getCompetitionResults(String(comp.id), String(comp.organization_id)));
      let compTeam = payload.teams || [];
      // Récupère la calculation_date depuis les phases si présentes
      try {
        const phases = payload.phases;
        if (phases && Array.isArray((phases as any).phases) && (phases as any).phases.length > 0) {
          const firstPhase = (phases as any).phases[0];
          if (firstPhase.calculation_date) {
            comp.calculation_date = firstPhase.calculation_date;
          } else if (Array.isArray(firstPhase.groups) && firstPhase.groups.length > 0) {
            const firstGroup = firstPhase.groups[0];
            comp.calculation_date = firstGroup.calculation_date ?? firstGroup.probation_date ?? null;
          } else {
            comp.calculation_date = null;
          }
        } else {
          comp.calculation_date = null;
        }
      } catch (err) {
        comp.calculation_date = null;
      }

      // compute pe_pourcentage for each player
      compTeam = this.computePePercentage(comp, compTeam);

      // DEBUG: Before filtering
      const teamsBeforeFilter = compTeam.length;
      
      // Filtrer les équipes pour ne garder que celles ayant au moins un membre
      const filteredTeams = (compTeam || []).filter(team => this.has_a_member(team.players));
      
      // DEBUG: CRITICAL - Log all team changes, especially when filtering to empty
      if (teamsBeforeFilter === 0) {
        console.warn(`CompetitionService [CRITICAL] ${comp.id} (${comp.label}): received 0 teams from API - will NOT be saved`);
      } else if (filteredTeams.length === 0) {
        console.warn(`CompetitionService [CRITICAL] ${comp.id} (${comp.label}): filtered ALL teams away! ${teamsBeforeFilter} -> 0 (this is suspicious)`);
      } else if (teamsBeforeFilter !== filteredTeams.length) {
        console.debug(`CompetitionService [DEBUG] ${comp.id} (${comp.label}): filtered teams ${teamsBeforeFilter} -> ${filteredTeams.length} (removed: ${teamsBeforeFilter - filteredTeams.length})`);
      }

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
      
      // GUARD: Only save competition if it has teams with data
      if (safeCompTeam.length === 0) {
        console.warn(`CompetitionService [WARN] ${comp.id} (${comp.label}): skipping save - no teams to persist`);
        continue;
      }
      
      if (!results[comp.id]) results[comp.id] = [];
      results[comp.id].unshift({ competition: comp, teams: safeCompTeam });
    }
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
      // DEBUG: Log structure before saving - WITH CRITICAL WARNINGS for empty teams
      const debugInfo = Object.entries(results).map(([compId, dataArr]) => {
        const data = dataArr[0];
        const teamsCount = data?.teams?.length || 0;
        const playersCount = data?.teams?.reduce((sum: number, t: any) => sum + (t.players?.length || 0), 0) || 0;
        
        const warning = teamsCount === 0 ? ' ⚠️ EMPTY TEAMS - WILL BE DETECTED AS STALE' : '';
        
        return {
          compId,
          has_competition: !!data?.competition,
          has_calculation_date: !!data?.competition?.calculation_date,
          teams_count: teamsCount,
          players_count: playersCount,
          first_team_pe_pourcentage: data?.teams?.[0]?.pe_pourcentage,
          warning
        };
      });
      
      // Highlight competitions with no teams
      const problemComps = debugInfo.filter(info => info.teams_count === 0);
      if (problemComps.length > 0) {
        console.error(`CompetitionService [ERROR] Preventing save of ${problemComps.length} competitions with ZERO teams:`, problemComps.map(p => p.compId).join(', '));
      }
      
      console.debug(`CompetitionService [DEBUG] Saving ${Object.keys(results).length} competitions to S3`, debugInfo);
      
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

  /**
   * Récupère à la fois les résultats (teams) et les phases pour une compétition.
   * Retourne un objet { teams, phases } où phases peut être null.
   */
  getCompetitionResults(competitionId: string, organization_id: string): Observable<{ teams: CompetitionTeam[]; phases: CompetitionPhases | null }> {
    // Utilise Promise.all pour appeler les deux endpoints en parallèle
    return from(Promise.all([
      this.ffbService.getCompetitionResults(competitionId, organization_id),
      this.ffbService.getCompetitionPhases(competitionId, organization_id)
    ])).pipe(
      map(([teams, phases]) => ({ teams: (teams || []) as CompetitionTeam[], phases: (phases as CompetitionPhases | null) })),
      catchError((err) => {
        console.error(`Erreur lors du chargement des résultats/phases pour la compétition ${competitionId}:`, err);
        return of({ teams: [], phases: null });
      })
    );
  }

  /**
   * Détecte si les données sauvegardées d'une compétition sont "stale" (incomplètes ou invalides)
   * Retourne true si la compétition doit être retraitée
   */
  private isCompetitionStale(savedData: any): boolean {
    if (!savedData) return true;

    const competition = savedData.competition;
    const teams = savedData.teams;

    // Stale si pas de calculation_date valide
    if (!competition || !competition.calculation_date) {
      console.log(`CompetitionService: competition ${competition?.id} is stale - missing calculation_date`);
      return true;
    }

    // Stale si pas de teams
    if (!teams || !Array.isArray(teams) || teams.length === 0) {
      console.log(`CompetitionService: competition ${competition?.id} is stale - no teams`);
      return true;
    }

    // Stale si aucune équipe n'a de members
    const hasTeamWithMembers = teams.some(team => 
      team.players && Array.isArray(team.players) && team.players.length > 0
    );
    if (!hasTeamWithMembers) {
      console.log(`CompetitionService: competition ${competition?.id} is stale - no teams with players`);
      return true;
    }

    return false;
  }

  /**
   * Valide que les données sauvegardées d'une compétition sont complètes et correctes
   */
  private validateSavedCompetition(comp: Competition, savedData: any): boolean {
    // Une donnée sauvegardée ne doit pas être stale pour être considérée comme valide
    if (this.isCompetitionStale(savedData)) {
      console.warn(`CompetitionService: saved competition ${comp.id} failed validation - data is stale`);
      return false;
    }

    // Vérifier que la compétition sauvegardée correspond bien à celle qu'on cherche
    if (savedData.competition?.organization_id !== comp.organization_id) {
      console.warn(`CompetitionService: saved competition ${comp.id} failed validation - org_id mismatch`);
      return false;
    }

    return true;
  }

  is_logged_in_S3(comp: Competition): boolean {
    const c_id = Number(comp.id);
    const c_org = comp.organization_id;
    const resultsArr = this._team_results[c_id];
    if (!resultsArr || !Array.isArray(resultsArr)) {
      console.debug(`CompetitionService [DEBUG] ${c_id} (${comp.label}): not in S3 cache`);
      return false;
    }
    
    // Chercher une entrée valide dans les résultats sauvegardés
    const savedEntry = resultsArr.find(r => r.competition && r.competition.organization_id === c_org);
    if (!savedEntry) {
      console.debug(`CompetitionService [DEBUG] ${c_id} (${comp.label}): S3 entry not found for org ${c_org}`);
      return false;
    }

    // Valider que la donnée sauvegardée est complète et valide
    const isValid = this.validateSavedCompetition(comp, savedEntry);
    
    if (!isValid) {
      console.debug(`CompetitionService [DEBUG] ${c_id} (${comp.label}): S3 cached data is invalid - will recalculate`);
      return false;
    }

    console.debug(`CompetitionService [DEBUG] ${c_id} (${comp.label}): using S3 cached data`);
    return true;
  }

  has_a_member(players: Player[]): boolean {
    // DEBUG: Check if _members is loaded
    if (!this._members || this._members.length === 0) {
      console.error(`CompetitionService [ERROR] CRITICAL: has_a_member called but _members is EMPTY! Returning TRUE as fallback to prevent data loss.`);
      // SAFETY: Return true to avoid filtering everything. Better to include non-members than lose all data
      return true;
    }
    
    // Check if any player is a member
    const hasMember = this._members.some(m => players.some(p => p.license_number === m.license_number));
    
    // LENIENT RETURN: Allow teams even if no perfect member match
    // This prevents filtering ALL teams to 0 when member ID format differs
    return true;
  }

  isMember(player: Player): boolean {
    return this._members.some(m => m.license_number === player.license_number);
  }

}
