import { Injectable } from '@angular/core';
import { toCompetitionListFromSearchResponseLegacy } from '../../common/ffb/adapters/ffb-api.adapter';
import { Competition, COMPETITION_DIVISION_LABELS, COMPETITION_LEVELS, CompetitionOrganization, CompetitionResultStade_V2, CompetitionTeam, Competition_V2, Entity_V2, Player, CompetitionPhases, SessionRankingEntry } from './competitions.interface';
import { FFB_Season } from '../../common/ffb/interface/ffb-season.interface';

import { CompetitionResultsMap } from './competitions.interface';
import { FFB_proxyService } from '../../common/ffb/services/ffb.service';
import { MembersService } from '../../common/services/members.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { from, map, Observable, catchError, of, switchMap, tap, lastValueFrom, concatMap, reduce, forkJoin } from 'rxjs';
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
  ffbScanDone: boolean = false;
  traceCompetitionIds: number[] = [];

  COMPETITION_LEVELS = COMPETITION_LEVELS;

  private traceFfb(message: string, context?: unknown): void {
    if (typeof context === 'undefined') {
      console.log(`[FFB TRACE][CompetitionService] ${message}`);
      return;
    }
    console.debug(`[FFB TRACE][CompetitionService] ${message}`, context);
  }

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
            this._members = [];
          } else {
            this._members = members;
          }
          this._memberLoaded = true;
          resolve();
        },
        error => {
          console.error(`❌ CompetitionService [CRITICAL] members loading failed:`, error);
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
    if (this._memberLoaded) return;
    await this._memberPromise;
    if (!this._members || this._members.length === 0) {
      console.error(`❌ [CompetitionService] Members failed to load — filtering disabled`);
    }
  }
  // getCompetitionOrganizations(
  //   organizationLabels: { comite: string; ligue: string; national: string } = {
  //     comite: 'Comité des Pyrénées',
  //     ligue: 'Ligue 06 LR-PY',
  //     national: 'FFB',
  //   }
  // ): Observable<CompetitionOrganization[]> {
  //   const labels = [
  //     organizationLabels[this.COMPETITION_LEVELS.National],
  //     organizationLabels[this.COMPETITION_LEVELS.Ligue],
  //     organizationLabels[this.COMPETITION_LEVELS.Comite],
  //   ];

  //   if (labels.some(l => l === undefined)) {
  //     console.warn('Attention: une des valeurs preferred_organizations est undefined', labels);
  //   } else {
  //     // console.log('Labels utilisés pour organisations:', labels);
  //   }
  //   this._organizations = labels.map((label, index) => ({
  //     id: index + 1,
  //     label,
  //     type: '',
  //     subordinate_id: 0,
  //     organization_code: '',
  //     has_realbridge_tournament: false,
  //     has_funbridge_tournament: false,
  //     is_club_digital: false,
  //     can_renew_member: false,
  //     can_renew_external_member: false,
  //     email_renew_member: null,
  //   }));
  //   return of(this._organizations);
  // }
 
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
    const norm = (s: string | undefined) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    // normalize labelToUse once
    const nLabel = norm(labelToUse);
    const key = Object.keys(division_labels).find(k => {
      const val = division_labels[k];
      // match if labelToUse starts with the key (abbrev), or equals the mapped value,
      // or starts with the mapped value (e.g. "Division de Ligue")
      return nLabel.startsWith(norm(k)) || norm(val) === nLabel || nLabel.startsWith(norm(val));
    });
    if (!key) return 'Autres';
    return division_labels[key] || 'Autres';
  }
  getCompetionsResults(
    season: string,
    organization_labels: { comite: string; ligue: string; national: string },
    full_regeneration: boolean,
    preferredEntities?: Entity_V2[]  // Load by organizations instead of FFB search
  ): Observable<CompetitionResultsMap> {
    let labels: string[];
    if (organization_labels && typeof organization_labels === 'object') {
      labels = [organization_labels[COMPETITION_LEVELS.National], organization_labels[COMPETITION_LEVELS.Ligue], organization_labels[COMPETITION_LEVELS.Comite]];
    } else {
      labels = ['FFB', 'Ligue 06 LR-PY', 'Comité des Pyrénées'];
    }
    if (labels.some(l => l === undefined)) {
      console.warn('Attention: une des valeurs preferred_organizations est undefined', labels);
    }

    this._preferred_organizations = labels.map((label, index) => ({
      id: index + 1,
      label,
      type: '',
      subordinate_id: 0,
      organization_code: '',
      has_realbridge_tournament: false,
      has_funbridge_tournament: false,
      is_club_digital: false,
      can_renew_member: false,
      can_renew_external_member: false,
      email_renew_member: null,
    }));

    this.traceFfb('Start getCompetionsResults', {
      season,
      full_regeneration,
      preferredOrganizations: labels,
    });

    // Fetch both current and previous seasons to ensure we find the requested season
    return from(Promise.all([
      this.ffbService.getCurrentSeason(),
      this.ffbService.getPreviousSeasons()
    ])).pipe(
      switchMap(([currentSeason, previousSeasons]: [FFB_Season | null, FFB_Season[]]) => {
        // Combine all available seasons
        const allSeasons: FFB_Season[] = [];
        if (currentSeason) allSeasons.push(currentSeason);
        allSeasons.push(...(previousSeasons || []));
        
        // Remove duplicates by label
        const uniqueSeasons = Array.from(
          new Map(allSeasons.map(s => [s.label, s])).values()
        );
        
        // Find the season matching the requested label
        const seasonObj = uniqueSeasons.find(s => s.label === season);
        
        this.traceFfb('Response getAllSeasons', {
          requestedSeason: season,
          availableSeasons: uniqueSeasons.map(s => s.label),
          matchedSeasonId: seasonObj?.id ?? null,
          matchedSeasonLabel: seasonObj?.label ?? null,
        });

        if (!seasonObj) {
          console.warn(`[CompetitionService] getCompetionsResults: season not found (${season}). Available seasons: ${uniqueSeasons.map(s => s.label).join(', ')}`);
          return of([] as Competition[]);
        }

        this.traceFfb('Request getCompetitionsForResults', { seasonId: String(seasonObj.id) });

        // Sequential org searches then national — avoids FFB rate-limit under parallel load
        const allOrgs: Array<{ org: Entity_V2 | null }> = [
          ...(preferredEntities ?? []).map(org => ({ org })),
          { org: null }, // null = national search
        ];
        const orgMapSource$ = from(allOrgs).pipe(
          concatMap(({ org }) => {
            const search$ = org
              ? from(this.ffbService.getCompetitionsSearchRaw(String(seasonObj.id), String(org.id))).pipe(
                  map((raw: unknown) => toCompetitionListFromSearchResponseLegacy(raw).map(c => ({ ...c, organization_id: org.id }))),
                  catchError(() => of([] as Competition[]))
                )
              : from(this.ffbService.getCompetitionsSearchRaw(String(seasonObj.id))).pipe(
                  map((raw: unknown) => toCompetitionListFromSearchResponseLegacy(raw).map(c => ({ ...c, organization_id: 0 }))),
                  catchError(() => of([] as Competition[]))
                );
            return search$.pipe(map(comps => ({ org, comps })));
          }),
          reduce((acc: { orgComps: Competition[]; nationalComps: Competition[] }, { org, comps }) => {
            if (org) acc.orgComps.push(...comps);
            else acc.nationalComps.push(...comps);
            return acc;
          }, { orgComps: [] as Competition[], nationalComps: [] as Competition[] }),
          map(({ orgComps, nationalComps }) => {
            const coveredFamilyIds = new Set(orgComps.map(c => c.family.id));
            const nationalOnly = nationalComps.filter(c => !coveredFamilyIds.has(c.family.id));
            return [...orgComps, ...nationalOnly];
          })
        );

        return orgMapSource$.pipe(
          switchMap((competitions: Competition[]) => {
            return of({ seasonObj, competitions });
          }),
          switchMap((payload: { seasonObj: FFB_Season; competitions: Competition[] }) => {
            if (full_regeneration === true) {
              this._team_results = {};
              return of({ ...payload, baseResults: {} as CompetitionResultsMap });
            }

            const safeSeason = season.replace(/\//g, '_');
            return from(this.fileService.download_json_file('any/resultats' + safeSeason + '.txt', true, false)).pipe(
              tap((data: any) => {
                this._team_results = data;
              }),
              catchError(() => {
                this._team_results = {};
                return of(null);
              }),
              map(() => ({ ...payload, baseResults: { ...this._team_results } as CompetitionResultsMap }))
            );
          }),

          switchMap((payload: { seasonObj: FFB_Season; competitions: Competition[]; baseResults: CompetitionResultsMap }) => {
            return from(this.ensureMembersLoaded()).pipe(
              map(() => payload)
            );
          }),
          map((payload: { seasonObj: FFB_Season; competitions: Competition[]; baseResults: CompetitionResultsMap }) => {
            let current = payload.competitions
              .filter(c => !c.label.startsWith('E '))
              .filter(c => !c.label.startsWith('Funtour'))
              .filter(c => c.type.label === 'Fédérale');
            const isCurrentSeason = this.systemService.get_today_season() === season;
            if (isCurrentSeason && !full_regeneration) {
              current = current.filter(c => c.allGroupsProbated === true);
            }
            current = current.filter(c => full_regeneration || !this.is_logged_in_S3(c));
            console.log(`[CompetitionService] Filters: ${payload.competitions.length} → ${current.length} to process`);
            return { ...payload, competitions: current };
          }),
          switchMap((payload: { seasonObj: FFB_Season; competitions: Competition[]; baseResults: CompetitionResultsMap }) => {
            return from(this.runSerial(payload.competitions, String(payload.seasonObj.id)) as Promise<CompetitionResultsMap>).pipe(
              map((results: CompetitionResultsMap) => {
                return { ...payload.baseResults, ...results };
              }),
              switchMap((merged) => from(this.saveResults(season, merged)).pipe(
                map(() => merged)
              )),
            );
          })
        );
      })
    ) as Observable<CompetitionResultsMap>;
  }

  // Exécution séquentielle des requêtes pour chaque compétition
  private async runSerial(competitions: Competition[], seasonId: string): Promise<CompetitionResultsMap> {
    const results: CompetitionResultsMap = {};
    console.log(`[CompetitionService] runSerial() starting with ${competitions.length} competitions`);
    const BATCH = 3;
    for (let i = 0; i < competitions.length; i += BATCH) {
      const batch = competitions.slice(i, i + BATCH);
      const batchResults = await Promise.all(batch.map(c => this._processComp(c, seasonId)));
      for (const r of batchResults) {
        if (r) {
          if (!results[r.compId]) results[r.compId] = [];
          results[r.compId].unshift(r.entry);
        }
      }
    }
    console.log(`[CompetitionService] runSerial() completed: ${Object.keys(results).length} competitions with results`);
    return results;
  }

  private async _processComp(
    comp: Competition,
    seasonId: string,
  ): Promise<{ compId: number; entry: { competition: Competition; teams: CompetitionTeam[] } } | null> {
    if (this.traceCompetitionIds.length > 0 && !this.traceCompetitionIds.includes(comp.id)) return null;
    // organization_id = 0 allowed for national competitions (Espérance etc.)
    if (comp.organization_id == null) return null;
    try {
      comp.assigned_division = this.getDivisionCategoryToLabel(comp);
      comp.assigned_label = comp.assigned_division === 'Interclubs' ? comp.label : comp.family.label;

      let stades = await this.ffbService.getCompetitionDivisionResults(String(comp.id), seasonId);
      // Retry with competition template id if item.id returns nothing
      if (!stades.length && comp.family?.id && comp.family.id !== comp.id) {
        stades = await this.ffbService.getCompetitionDivisionResults(String(comp.family.id), seasonId);
      }
      let orgStade = stades.find(s => s.groupement?.id === comp.organization_id);
      // If org stade's finale is non-sim multi-group, prefer a simultaneous stade (national FN)
      if (orgStade?.phases?.length) {
        const lp = orgStade.phases[orgStade.phases.length - 1];
        if (!lp.simultaneous && lp.groups.length > 1) {
          const simStade = stades.find(s => s.phases?.length > 0 && (s.phases[s.phases.length - 1].simultaneous));
          if (simStade) {
            orgStade = simStade;
            comp.organization_id = simStade.groupement?.id ?? comp.organization_id;
          }
        }
      }
      // Fallback: national competitions (org=0) or org mismatch — use first stade with phases
      if (!orgStade?.phases?.length) {
        orgStade = stades.find(s => s.phases?.length > 0);
        if (orgStade?.groupement?.id) comp.organization_id = orgStade.groupement.id;
      }
      if (!orgStade?.phases?.length) return null;

      // Use last phase only — earlier phases are qualifying rounds, last phase has the final cumulative ranking
      const finalPhase = orgStade.phases[orgStade.phases.length - 1];
      // Non-simultaneous multi-group = independent local groups, merged ranking is meaningless
      if (!finalPhase.simultaneous && finalPhase.groups.length > 1) return null;

      // For simultaneous (FN) phases: one representative group is enough — the ranking returns all venues combined
      const groupsToFetch = finalPhase.simultaneous
        ? finalPhase.groups.filter(g => g.resultCount > 0).slice(0, 1)
        : finalPhase.groups;
      if (!groupsToFetch.length) return null;
      const sessionResults = (await Promise.all(
        groupsToFetch.map(g => this.ffbService.getSessionWithDateFromGroup(g.id))
      )).filter((r): r is { id: number; date: string | null; simultaneousId: number | null } => r !== null);
      if (!sessionResults.length) return null;

      const latestDate = sessionResults
        .map(r => r.date)
        .filter((d): d is string => !!d)
        .sort()
        .at(-1) ?? null;

      const compTeam = await this.ffbService.getSessionRankingAsTeams(sessionResults);
      // console.log(`[_processComp] comp ${comp.id} (${comp.label}): ${sessionResults.length} sessions, ${compTeam.length} teams, date=${latestDate}, sim=${finalPhase.simultaneous}`);
      this.calculatePePercentageBeforeFilter(comp, compTeam);

      const filteredTeams = compTeam.filter(t => this.has_a_member(t.players));
      if (!filteredTeams.length) return null;

      filteredTeams.forEach(team => {
        team.players.forEach(p => { p.is_member = this.isMember(p); });
      });
      filteredTeams.sort((a, b) => (this.has_a_member(a.players) ? 0 : 1) - (this.has_a_member(b.players) ? 0 : 1));
      filteredTeams.forEach(t => t.players.sort((p1, p2) => (p1.is_member ? 0 : 1) - (p2.is_member ? 0 : 1)));

      comp.calculation_date = latestDate; // null = date inconnue, la date pipe affichera rien
      comp.session_id = sessionResults[0]?.id;
      return { compId: comp.id, entry: { competition: comp, teams: filteredTeams } };
    } catch (error: any) {
      if ((error?.status || error?.statusCode) !== 404) {
        console.error(`[CompetitionService] Error comp ${comp.id}:`, error?.message || error);
      }
      return null;
    }
  }

  // weighted_rank = inverted totalScore so existing filter (weighted_rank <= threshold) maps to totalScore >= (100-threshold)
  private calculatePePercentageBeforeFilter(comp: Competition, teams: CompetitionTeam[]): void {
    const n = teams.length;
    comp.cumulated_pe_percentage = n;
    const scores = teams.map(t => t.totalScore ?? 0);
    teams.forEach((team) => {
      const score = team.totalScore ?? 0;
      const betterCount = scores.filter(s => s > score).length;
      // 0 = meilleure équipe (personne n'a fait mieux), 100 = dernière
      team.weighted_rank = n > 1 ? (betterCount / (n - 1)) * 100 : 0;
      // affichage: % d'équipes battues (plus élevé = mieux)
      team.pe_pourcentage = Math.round(100 - team.weighted_rank);
    });
  }

  async saveResults(season: string, results: CompetitionResultsMap): Promise<void> {
    const safeSeason = season.replace(/\//g, '_');
    const isEmpty = !results || Object.keys(results).length === 0;
    if (isEmpty) {
      await this.fileService.upload_to_S3({}, 'any/', 'resultats' + safeSeason + '.txt');
      return;
    }
    const problemComps = Object.entries(results).filter(([, arr]) => !arr[0]?.teams?.length).map(([id]) => id);
    if (problemComps.length > 0) {
      console.error(`[CompetitionService] saving ${problemComps.length} competitions with ZERO teams:`, problemComps.join(', '));
    }
    await this.fileService.upload_to_S3(results, 'any/', 'resultats' + safeSeason + '.txt');
    console.log(`[CompetitionService] saved ${Object.keys(results).length} competitions (season ${season})`);
  }

  getSeasons(): Observable<FFB_Season | null> {
    return from(this.ffbService.getCurrentSeason());
  }

  getCurrentCompetitionSeason(): Observable<FFB_Season | null> {
    const current_season = this.systemService.get_today_season();
    return from(this.ffbService.getCurrentSeason()).pipe(
      map(season => (season && season.label === current_season) ? season : null)
    );
  }

  getPreviousSeasons(): Observable<FFB_Season[]> {
    return from(this.ffbService.getPreviousSeasons());
  }

  getCompetitions(seasonId: string): Observable<Competition_V2[]> {
    return from(this.ffbService.getCompetitions(seasonId));
  }

  getCompetitionsByOrganization(seasonId: string, organizationId: string): Observable<Competition_V2[]> {
    return from(this.ffbService.getCompetitionsByOrganization(seasonId, organizationId));
  }

  getEntity(label: string): Observable<Entity_V2[]> {
    return from(this.ffbService.getEntity(label));
  }

  getCompetitionResultsBySeason(competitionId: string, seasonId: string): Observable<CompetitionResultStade_V2[]> {
    return from(this.ffbService.getCompetitionDivisionResults(competitionId, seasonId)).pipe(
      catchError((err) => {
        console.error(`Erreur lors du chargement des stades pour la compétition ${competitionId} (saison ${seasonId}):`, err);
        return of([] as CompetitionResultStade_V2[]);
      })
    );
  }

  loadPreferredOrganizationCompetitionsWithStades(
    seasonId: string,
    preferredOrganizations: Entity_V2[],
    preferredOrganizationLabels?: { comite: string; ligue: string; national: string }
  ): Observable<{ seasonId: string; competitions: Competition_V2[] }> {
    if (!seasonId || preferredOrganizations.length === 0) {
      return of({
        seasonId,
        competitions: [],
      });
    }

    const allowedStadeNames = this.getAllowedStadeNames(preferredOrganizationLabels);

    this.traceFfb('Start loadPreferredOrganizationCompetitionsWithStades', {
      seasonId,
      organizationIds: preferredOrganizations.map((org) => org.id),
      allowedStadeNames,
    });

    return from(preferredOrganizations).pipe(
      concatMap((organization) =>
        (this.traceFfb('Request getCompetitionsByOrganization', {
          seasonId,
          organizationId: organization.id,
        }),
        this.getCompetitionsByOrganization(seasonId, String(organization.id)).pipe(
          map((competitions) => ({ organizationId: organization.id, competitions })),
          catchError(() => of({ organizationId: organization.id, competitions: [] as Competition_V2[] }))
        ))
      ),
      reduce((allCompetitions, entry) => {
        const filteredCompetitions = this.filterCompetitionsForDisplay(entry.competitions);
        allCompetitions.push(...filteredCompetitions);
        return allCompetitions;
      }, [] as Competition_V2[]),
      map((competitions) => this.uniqueCompetitionsById(competitions)),
      switchMap((competitions) => {
        if (competitions.length === 0) {
          return of({ seasonId, competitions });
        }

        return from(competitions).pipe(
          concatMap((competition) =>
            (this.traceFfb('Request getCompetitionDivisionResults', {
              competitionId: competition.id,
              seasonId,
            }),
            this.getCompetitionResultsBySeason(String(competition.id), seasonId).pipe(
              map((stades) => ({ competitionId: competition.id, stades })),
              catchError(() => of({ competitionId: competition.id, stades: [] as CompetitionResultStade_V2[] }))
            ))
          ),
          reduce((stadesById, entry) => {
            const filteredStades = this.filterStadesByPreferredLabels(entry.stades, allowedStadeNames);
            stadesById[entry.competitionId] = filteredStades;
            return stadesById;
          }, {} as { [competitionId: number]: CompetitionResultStade_V2[] }),
          map((stadesById) =>
            competitions.map((competition) => ({
              ...competition,
              stades: stadesById[competition.id] || [],
            }))
          ),
          map((competitionsWithStades) => ({ seasonId, competitions: competitionsWithStades }))
        );
      })
    );
  }

  /**
   * Version simplifiee: getCompetitionResults(id)
   * Retourne les stades reduits pour la saison courante.
   */
  getCompetitionResults(competitionId: string): Observable<CompetitionResultStade_V2[]>;

  /**
   * Récupère à la fois les résultats (teams) et les phases pour une compétition.
   * Retourne un objet { teams, phases } où phases peut être null.
   */
  getCompetitionResults(competitionId: string, organization_id: string): Observable<{ teams: CompetitionTeam[]; phases: CompetitionPhases | null }>;

  getCompetitionResults(
    competitionId: string,
    organization_id?: string
  ): Observable<CompetitionResultStade_V2[] | { teams: CompetitionTeam[]; phases: CompetitionPhases | null }> {
    if (!organization_id) {
      return from(this.ffbService.getCurrentSeason()).pipe(
        switchMap((season) => {
          if (!season) {
            return of([] as CompetitionResultStade_V2[]);
          }
          this.traceFfb('Request getCompetitionDivisionResults (current season)', {
            competitionId,
            seasonId: String(season.id),
          });
          return from(this.ffbService.getCompetitionDivisionResults(competitionId, String(season.id)));
        }),
        catchError((err) => {
          console.error(`Erreur lors du chargement des stades pour la compétition ${competitionId}:`, err);
          return of([] as CompetitionResultStade_V2[]);
        })
      );
    }

    // Cas 3: avec org_id → utilise Promise.all des deux endpoints en parallèle

    return from(Promise.all([
      this.ffbService.getCompetitionResults(competitionId, organization_id),
      this.ffbService.getCompetitionPhases(competitionId, organization_id)
    ])).pipe(
      map(([teams, phases]) => {
        const normalizedTeams = (teams || []) as CompetitionTeam[];
        const normalizedPhases = phases as CompetitionPhases | null;

        this.traceFfb('Response parallel competition endpoints', {
          competitionId,
          organization_id,
          teamsCount: normalizedTeams.length,
          hasPhases: !!normalizedPhases,
        });

        return { teams: normalizedTeams, phases: normalizedPhases };
      }),
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

    if (!competition || !competition.calculation_date) return true;
    if (!teams || !Array.isArray(teams) || teams.length === 0) return true;
    const hasTeamWithMembers = teams.some(team =>
      team.players && Array.isArray(team.players) && team.players.length > 0
    );
    if (!hasTeamWithMembers) return true;

    return false;
  }

  private filterCompetitionsForDisplay(competitions: Competition_V2[]): Competition_V2[] {
    const divisionKeys = Object.keys(COMPETITION_DIVISION_LABELS);
    const normalize = (value: string) =>
      (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    return competitions.filter((competition) => {
      const normalizedLabel = normalize(competition.label || '');
      if (normalizedLabel.startsWith('e ') || normalizedLabel.startsWith('funtour')) {
        return false;
      }

      const divisionLabel = competition.division || '';
      return divisionKeys.some((key) => normalize(divisionLabel).startsWith(normalize(key)));
    });
  }

  private uniqueCompetitionsById(competitions: Competition_V2[]): Competition_V2[] {
    const uniqueById = new Map<number, Competition_V2>();
    competitions.forEach((competition) => {
      if (!uniqueById.has(competition.id)) {
        uniqueById.set(competition.id, competition);
      }
    });
    return Array.from(uniqueById.values());
  }

  private getAllowedStadeNames(preferredOrganizationLabels?: { comite: string; ligue: string; national: string }): string[] {
    if (!preferredOrganizationLabels) {
      return [];
    }

    return [
      preferredOrganizationLabels.national,
      preferredOrganizationLabels.ligue,
      preferredOrganizationLabels.comite,
    ].filter((name): name is string => !!name && name.trim().length > 0);
  }

  private filterStadesByPreferredLabels(stades: CompetitionResultStade_V2[], allowedNames: string[]): CompetitionResultStade_V2[] {
    if (!allowedNames.length) {
      return stades;
    }

    const normalize = (value: string) =>
      (value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const normalizedAllowedNames = allowedNames.map(normalize);

    return stades.filter((stade) => {
      const normalizedStadeName = normalize(stade.name || '');
      return normalizedAllowedNames.some((allowedName) =>
        normalizedStadeName === allowedName ||
        normalizedStadeName.includes(allowedName) ||
        allowedName.includes(normalizedStadeName)
      );
    });
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
    const resultsArr = this._team_results[c_id];
    if (!resultsArr || !Array.isArray(resultsArr)) return false;
    const savedEntry = resultsArr.find(r => r.competition && r.competition.organization_id === comp.organization_id);
    if (!savedEntry) return false;
    return this.validateSavedCompetition(comp, savedEntry);
  }

  /**
   * Normalise un numéro de licence pour comparaison robuste
   * Gère: whitespace, leading zeros, casse
   */
  private licensesMatch(playerLicense: string | undefined, memberLicense: string | undefined): boolean {
    if (!playerLicense || !memberLicense) return false;

    // Convert both to numbers and compare
    // This automatically handles leading zeros: Number("00035271") === Number("35271")
    const playerNum = Number(playerLicense);
    const memberNum = Number(memberLicense);

    // Both must be valid numbers and equal
    return !isNaN(playerNum) && !isNaN(memberNum) && playerNum === memberNum;
  }

  has_a_member(players: Player[]): boolean {
    // SAFETY: Return true if members not loaded - don't filter teams away!
    if (!this._members || this._members.length === 0) {
      return true;
    }

    // Check if ANY player matches ANY member
    return players.some(p =>
      this._members.some(m => this.licensesMatch(p.license_number, m.license_number))
    );
  }

  isMember(player: Player): boolean {
    return this._members.some(m => this.licensesMatch(player.license_number, m.license_number));
  }

  // ── Debug step-by-step helpers ────────────────────────────

  debugGetPhases(competitionId: string, organizationId: string): Observable<CompetitionPhases | null> {
    return from(this.ffbService.getCompetitionPhases(competitionId, organizationId));
  }

  debugGetGroupSessions(groupId: number): Observable<any[]> {
    return from(this.ffbService.getGroupSessions(groupId));
  }

  debugGetSessionRanking(sessionId: number): Observable<SessionRankingEntry[]> {
    return from(this.ffbService.getSessionRanking(sessionId));
  }

}
