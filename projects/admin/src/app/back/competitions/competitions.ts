import { Component } from '@angular/core';
import { Competition, CompetitionOrganization, CompetitionResultPhase_V2, CompetitionResultStade_V2, CompetitionResultsMap, CompetitionTeam, Player, CompetitionResults, COMPETITION_DIVISION_LABELS, Competition_V2, Entity_V2 } from './competitions.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompetitionService } from './competition.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { TitleService } from '../../front/title/title.service';
import { ActivatedRoute } from '@angular/router';
import { UIConfiguration } from '../../common/interfaces/ui-conf.interface';
import { Member } from '../../common/interfaces/member.interface';
import { MembersService } from '../../common/services/members.service';
import { FileService } from '../../common/services/files.service';
import { from, of, catchError, concat, tap, forkJoin, map, switchMap, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-competitions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './competitions.html',
  styleUrl: './competitions.scss'
})
export class CompetitionsComponent {
  current_season: string = '';
  competitions: Competition_V2[] = [];
  preferred_entities: Entity_V2[] = [];
  organizations: CompetitionOrganization[] = [];
  selectedCompetitionSeasonId: string = '';
  selectedSeasonLabel: string = '';  // Track season label for results loading
  results_extracted: boolean = false;
  team_results: CompetitionResultsMap = {};
  filtered_team_results: CompetitionResultsMap = {};

  divisions: string[] = Object.values(COMPETITION_DIVISION_LABELS);
  division_labels: { [key: string]: string } = COMPETITION_DIVISION_LABELS;

  preferred_organization_labels!: { comite: string; ligue: string; national: string };
  show_full_team!: boolean;
  one_year_back!: boolean;

  spinnerMessage: string = 'Recherche en cours...';
  back_office_mode: boolean = false;
  thresholdsModified: boolean = false;
  ui_config_loaded!: UIConfiguration;
  no_filter: boolean = false;
  full_regeneration: boolean = false;
  data_ready: boolean = false;
  trace_mode: boolean = false;
  is_refreshing: boolean = false;
  private _members: Member[] = [];
  // nombre de jours pour considérer une calculation_date comme récente
  private readonly RECENT_CALCULATION_DAYS: number = 30;

  // ── Debug step-by-step ─────────────────────────────────────
  debugMode = false;
  debugStep = 0;
  debugRunning = false;
  debugStepResults: Array<{ label: string; data: any; status: 'ok' | 'error' }> = [];
  private _debugSeasonId = '';
  private _debugOrgId = 0;
  private _debugCompetitionId = 0;
  private _debugSessionIds: number[] = [];


  constructor(
    private competitionService: CompetitionService,
    private systemService: SystemDataService,
    private titleService: TitleService,
    private route: ActivatedRoute,
    private memberService: MembersService,
    private fileService: FileService,
  ) { }

  ngOnInit(): void {
    // Load members for filtering
    this.memberService.listMembers().subscribe(members => {
      this._members = members || [];
    });

    // Access custom route data (e.g., 'access')
    this.route.data.subscribe(data => {
      let access = data['access'];
      if (typeof access === 'undefined') {
        this.back_office_mode = false;
      } else {
        this.back_office_mode = (access === 'full');
      }
    });

    // récuperer trace_mode depuis la configuration système pour ajuster le message du spinner
    this.systemService.get_configuration().subscribe(config => {
    this.trace_mode = config.trace_mode;
    });

    // Charger la configuration Competitions depuis ui-conf
    this.systemService.get_ui_settings().subscribe(ui => {
      this.ui_config_loaded = ui;
      
      const defaultLabels = { comite: 'Pyrénées', ligue: 'Ligue 06 LR-PY', national: 'FFB' };
      if (ui?.competitions?.preferred_organizations && typeof ui.competitions.preferred_organizations === 'object') {
        const orgs = ui.competitions.preferred_organizations;
        this.preferred_organization_labels = {
          comite: orgs.comite ?? defaultLabels.comite,
          ligue: orgs.ligue ?? defaultLabels.ligue,
          national: orgs.national ?? defaultLabels.national
        };
      } else {
        this.preferred_organization_labels = defaultLabels;
      }
    
      // this.one_year_back = false;  // Default: current season
      this.one_year_back = true;  // for testing: load previous season by default
      
      // Show spinner before starting to load competitions
      this.results_extracted = false;
      this.is_refreshing = true;
      this.spinnerMessage = 'Chargement des compétitions...';
      
      // Delegate to reloadCompetitionsAndResults to avoid code duplication
      this.reloadCompetitionsAndResults();
      
      this.show_full_team = false;
      this.no_filter = false;
      this.data_ready = true;
    });
  }

  getPhaseGroupIds(phase: CompetitionResultPhase_V2): string {
    return phase.groups.map((g) => g.id).join(', ');
  }

  getCompetitionStades(competitionId: number): CompetitionResultStade_V2[] {
    const competition = this.competitions.find((item) => item.id === competitionId);
    return competition?.stades || [];
  }

  /**
   * Retourne vrai si la calculation_date est dans les derniers RECENT_CALCULATION_DAYS jours.
   */
  isRecentCalculation(calcDate?: string | null): boolean {
    if (!calcDate) return false;
    const d = new Date(calcDate);
    if (isNaN(d.getTime())) return false;
    const diffMs = Date.now() - d.getTime();
    return diffMs >= 0 && diffMs <= this.RECENT_CALCULATION_DAYS * 24 * 60 * 60 * 1000;
  }
  onParamsChange(reload:boolean): void {
    if (reload) {
      this.results_extracted = false;
      this.is_refreshing = true;
      this.spinnerMessage = 'Chargement de la saison...';
      
      if (this.back_office_mode) {
        // Back-office: reload competitions V2 AND results (with FFB recalc)
        this.full_regeneration = true;
        this.selectedSeasonLabel = '';  // Reset to trigger full reload
        this.reloadCompetitionsAndResults();
        // Note: Do NOT reset full_regeneration here - let it be cleared by update_results() after completion
      } else {
        // Front mode: only load results from S3 for the new season (no FFB)
        this.update_results();
      }
    } else {
      this.thresholdsModified = true;
    }
  }

  onThresholdChange(division: string): void {
    // Just mark as modified
    // User must click "Sauvegarder" button to persist thresholds
    this.thresholdsModified = true;
  }

  private reloadCompetitionsAndResults(): void {
    // Same logic as initial load, but preserves current toggle state
    const preferredLabels = [
      this.preferred_organization_labels.national,
      this.preferred_organization_labels.ligue,
      this.preferred_organization_labels.comite,
    ];

    const preferredEntities$ = forkJoin(
      preferredLabels.map((label) =>
        this.competitionService.getEntity(label).pipe(
          map((entities) => entities[0] ?? null),
          catchError(() => of(null))
        )
      )
    ).pipe(
      map((entities) => entities.filter((e): e is Entity_V2 => !!e))
    );

    preferredEntities$.pipe(
      tap((entities) => {
        this.preferred_entities = entities;

        const nationalLabel = this.preferred_organization_labels.national;
        const nationalEntity = entities.find((entity) => entity.label === nationalLabel) ?? null;
        const organizationsToLoad = nationalEntity ? [nationalEntity] : entities;

        if (!nationalEntity) {
          console.warn('[CompetitionsComponent] National organization not found, fallback to all preferred organizations');
        }

        // all preferred entities needed for get_organization_label lookups
        this.organizations = entities.map((entity) => ({
          id: entity.id,
          label: entity.label,
          type: entity.type,
          subordinate_id: 0,
          organization_code: entity.ffbCode,
          has_realbridge_tournament: false,
          has_funbridge_tournament: false,
          is_club_digital: false,
          can_renew_member: false,
          can_renew_external_member: false,
          email_renew_member: null,
        }));
      }),
      switchMap((entities) => this.competitionService.getPreviousSeasons().pipe(
        map((seasons) => ({entities, seasons}))
      )),
      switchMap(({ entities, seasons }) => {
        const seasonIndex = this.one_year_back ? 1 : 0;
        const selectedSeason = seasons[seasonIndex] ?? seasons[0];

        if (!selectedSeason) {
          console.warn('[CompetitionsComponent] No season returned by getPreviousSeasons');
          return of({ seasonId: '', competitions: [] as Competition_V2[], selectedSeason: null });
        }

        return this.competitionService.loadPreferredOrganizationCompetitionsWithStades(
          String(selectedSeason.id),
          entities,
          this.preferred_organization_labels
        ).pipe(
          map(result => ({...result, selectedSeason}))
        );
      })
    ).subscribe({
      next: ({ seasonId, competitions, selectedSeason }) => {
        console.log('[CompetitionsComponent] getCompetitions response:', competitions);
        this.selectedCompetitionSeasonId = seasonId;
        this.competitions = competitions;
        if (selectedSeason) {
          this.selectedSeasonLabel = selectedSeason.label;
          this.current_season = selectedSeason.label;
        }
        this.update_results();
      },
      error: (error) => {
        console.error('[CompetitionsComponent] Error reloading competitions:', error);
        this.results_extracted = true;
        this.is_refreshing = false;
      }
    });
  }

  update_results(): void {
    // Use stored season label if available, otherwise calculate
    if (!this.selectedSeasonLabel) {
      this.current_season = this.one_year_back ? this.systemService.previous_season(this.systemService.get_today_season()) : this.systemService.get_today_season();
    } else {
      this.current_season = this.selectedSeasonLabel;
    }
    this.titleService.setTitle('Résultats des compétitions ' + this.current_season);
    this.results_extracted = false;
    this.is_refreshing = false;
    this.spinnerMessage = 'Chargement des résultats...';

    const safeSeason = this.current_season.replace(/\//g, '_');
    
    // Step 1: Create observable to load cached S3 results (silent on 404, it's normal for new seasons)
    const cachedResults$ = from(this.fileService.download_json_file('any/resultats' + safeSeason + '.txt', true, false)).pipe(
      catchError(() => of({} as CompetitionResultsMap)),
      tap(() => {
        // Only trigger FFB scan in back-office mode
        if (this.back_office_mode) {
          this.is_refreshing = true;
          this.spinnerMessage = 'Actualisation des données FFB en cours...';
        }
      })
    );

    // Step 2: Create observable for fresh results (includes FFB rescan)
    const freshResults$ = this.competitionService.getCompetionsResults(this.current_season, this.preferred_organization_labels, this.full_regeneration, this.preferred_entities).pipe(
      tap(() => {
        // FFB scan completed
        this.competitionService.ffbScanDone = true;
        this.is_refreshing = false;
      })
    );

    // Step 3: Emit cached results first, then fresh results (skip FFB scan on return visit)
    // In front mode, only load from S3 cache (no FFB recalculation)
    const pipeline$ = !this.back_office_mode
      ? cachedResults$.pipe(tap(() => { this.is_refreshing = false; }))
      : this.competitionService.ffbScanDone && !this.full_regeneration
        ? cachedResults$.pipe(tap(() => { this.is_refreshing = false; }))
        : concat(cachedResults$, freshResults$);

    pipeline$.subscribe(
      results => {
        this.processResults(results);
        this.results_extracted = true;
        // Auto-save thresholds after FFB recalculation in back-office mode
        if (this.back_office_mode && this.thresholdsModified) {
          this.saveThresholds();
        }
        // Clear the regeneration flag after processing
        this.full_regeneration = false;
      },
      error => {
        console.error('Erreur lors du chargement des résultats:', error);
        this.results_extracted = true;
        this.is_refreshing = false;
        // Clear the regeneration flag even on error
        this.full_regeneration = false;
      }
    );
  }

  private processResults(results: CompetitionResultsMap): void {
    // Filtrer les CompetitionResults dont toutes les teams sont vides
    const filteredResults: CompetitionResultsMap = {};
    Object.entries(results).forEach(([compId, compResults]) => {
      const validResults = (compResults as CompetitionResults[]).filter((r: CompetitionResults) =>
        Array.isArray(r.teams) && r.teams.some((team: CompetitionTeam) => Array.isArray(team.players) && team.players.length > 0)
      );
      if (validResults.length > 0) {
        filteredResults[Number(compId)] = validResults;
      }
    });
    // Ne garder que les compétitions où au moins un résultat a des équipes à afficher après filtrage
    const filteredToDisplay: CompetitionResultsMap = {};
    Object.entries(filteredResults).forEach(([compId, compResults]) => {
      const hasDisplayable = (compResults as CompetitionResults[]).some(res => this.getFilteredTeams(res).length > 0);
      if (hasDisplayable) {
        filteredToDisplay[Number(compId)] = compResults;
      }
    });
    this.team_results = filteredResults;
    this.filtered_team_results = filteredToDisplay;

    // Vérifier s'il y a des résultats pour la division 'Autres'
    const autresHasResults = Object.values(filteredToDisplay).some((arr: CompetitionResults[]) =>
      arr.some((res: CompetitionResults) => res.competition.assigned_division === 'Autres')
    );
    if (autresHasResults && !this.divisions.includes('Autres')) {
      this.divisions = [...this.divisions, 'Autres'];
      if (this.ui_config_loaded.competitions.show_infos) {
        const autresResults = Object.values(filteredToDisplay)
          .flatMap((arr: CompetitionResults[]) => arr.filter((res: CompetitionResults) => res.competition.assigned_division === 'Autres'));
        console.warn('[PROD TRACK] Résultats présents pour la division "Autres". Cas à surveiller.', autresResults);
      }
    }

    if (this.trace_mode) {
      console.log('CompetitionsComponent: received competition results', results);
    }

    this.results_extracted = true;
  }

  saveThresholds(): void {
    // Save thresholds only (without triggering global config reload)
    const thresholdsOnly = {
      ...this.ui_config_loaded,
      competitions: {
        ...this.ui_config_loaded.competitions,
        result_filter_thresholds: this.ui_config_loaded.competitions.result_filter_thresholds,
      }
    };
    
    // Call systemService method without triggering subject re-emit
    this.systemService.saveThresholdsOnly(thresholdsOnly).then(() => {
      this.thresholdsModified = false;
      console.log('Seuils sauvegardés:', this.ui_config_loaded.competitions.result_filter_thresholds);
    }).catch((err: unknown) => {
      console.error('Erreur lors de la sauvegarde des seuils:', err);
    });
  }

  get_organization_label(id: number): string {
    const org = this.organizations.find(o => o.id === id);
    if (!org) return 'Inconnu';
    // preferred_entities order matches preferredLabels: [national, ligue, comite]
    const levelKeys = ['national', 'ligue', 'comite'] as const;
    const idx = this.preferred_entities.findIndex(e => e.id === id);
    const niveau = idx >= 0 ? levelKeys[idx] : undefined;
    switch (niveau) {
      case 'comite':   return 'Comité';
      case 'ligue':    return 'Finale de Ligue';
      case 'national': return 'Finale Nationale';
      default:         return org.label;
    }
  }




  // Retourne la première division_label dont la clé commence par 'label'
  getDivisionLabelStartingWithLabel(): string | undefined {
    const key = Object.keys(this.division_labels).find(k => k.startsWith('label'));
    return key ? this.division_labels[key] : undefined;
  }

  isMember(player: Player): boolean {
    // Check if player's license_number exists in members list
    return this._members.some(m => m.license_number === player.license_number);
  }

  getDisplayedPlayers(players: Player[]): Player[] {
    if (!this.show_full_team) {
      return players.filter(p => p.is_member);
    }
    return players;
  }

  hasTeamsToDisplay(results: any[]): boolean {
    return Array.isArray(results) && results.some(r => r.teams && r.teams.length > 0);
  }

  hasFilteredTeamsToDisplay(results: any[]): boolean {
    return Array.isArray(results) && results.some(res => this.getFilteredTeams(res).length > 0);
  }

  getThreshold(competition: Competition): number {
    const divisionLabel = competition.assigned_division || 'Autres';
    return this.ui_config_loaded.competitions.result_filter_thresholds[divisionLabel];
  }

  getFilteredTeams(result: CompetitionResults): CompetitionTeam[] {
    if (!result || !Array.isArray(result.teams)) return [];
    const threshold = this.getThreshold(result.competition);
    return result.teams.filter((team: CompetitionTeam) =>
      this.no_filter ||
      !threshold ||
      threshold === 0 ||
      (team.weighted_rank as any) <= +threshold
    );
  }

  /**
   * Récupère les compétitions récentes groupées par division
   */
  resetDebug(): void {
    this.debugStep = 0;
    this.debugStepResults = [];
    this._debugSeasonId = '';
    this._debugOrgId = 0;
    this._debugCompetitionId = 0;
    this._debugSessionIds = [];
  }

  async runNextDebugStep(): Promise<void> {
    this.debugRunning = true;
    this.debugStep++;
    try {
      switch (this.debugStep) {
        case 1: {
          const seasons = await firstValueFrom(this.competitionService.getPreviousSeasons());
          const idx = this.one_year_back ? 1 : 0;
          this._debugSeasonId = String(seasons[idx]?.id ?? seasons[0]?.id ?? '');
          this._pushDebugStep('Step 1 — getPreviousSeasons', {
            count: seasons.length,
            seasons: seasons.map(s => ({ id: s.id, label: s.label })),
            one_year_back: this.one_year_back,
            selectedIndex: idx,
            selectedSeasonId: this._debugSeasonId,
          }, 'ok');
          break;
        }
        case 2: {
          const ligueLabel = this.preferred_organization_labels.ligue;
          const entities = await firstValueFrom(this.competitionService.getEntity(ligueLabel));
          const entity = entities[0] ?? null;
          this._debugOrgId = entity?.id ?? 0;
          this._pushDebugStep(`Step 2 — getEntity('${ligueLabel}')`, {
            found: entities.length,
            entity: entity ? { id: entity.id, label: entity.label, ffbCode: entity.ffbCode } : null,
            selectedOrgId: this._debugOrgId,
          }, entity ? 'ok' : 'error');
          break;
        }
        case 3: {
          const comps = await firstValueFrom(this.competitionService.getCompetitionsByOrganization(this._debugSeasonId, String(this._debugOrgId)));
          const target = comps.find(c => c.label === 'Mixte /2' && c.division === 'Division de Ligue') ?? comps.find(c => c.label === 'Mixte /2') ?? null;
          this._debugCompetitionId = target?.id ?? 0;
          this._pushDebugStep(`Step 3 — getCompetitionsByOrganization(season=${this._debugSeasonId}, org=${this._debugOrgId})`, {
            total: comps.length,
            allCompetitions: comps.map(c => ({ id: c.id, label: c.label, division: c.division })),
            target_Mixte2: target ? { id: target.id, label: target.label } : 'NOT FOUND',
            selectedCompId: this._debugCompetitionId,
          }, target ? 'ok' : 'error');
          break;
        }
        case 4: {
          // FFB sequence: results/competitionDivisions/{id}?seasonId=X → groups → competitions/groups/{groupId}/groupSessions → last session.id
          const stades = await firstValueFrom(this.competitionService.getCompetitionResultsBySeason(
            String(this._debugCompetitionId), this._debugSeasonId
          ));
          const ligueStade = stades.find(s => s.groupement?.id === this._debugOrgId) ?? null;
          const groupIds: number[] = [];
          if (ligueStade) {
            for (const phase of ligueStade.phases) {
              for (const group of phase.groups) {
                if (group.id) groupIds.push(group.id);
              }
            }
          }
          const sessionIds: number[] = [];
          const groupSessionDetails: any[] = [];
          for (const groupId of groupIds) {
            const sessions = await firstValueFrom(this.competitionService.debugGetGroupSessions(groupId));
            // take the session with the latest date (final séance), not last index (array is not date-sorted)
            const lastSession = sessions.reduce((best: any, s: any) => {
              if (!s.date) return best;
              if (!best || new Date(s.date) > new Date(best.date)) return s;
              return best;
            }, null);
            groupSessionDetails.push({ groupId, sessionCount: sessions.length, groupSessionId: lastSession?.id ?? null, sessionId: lastSession?.session?.id ?? null, lastSessionDate: lastSession?.date ?? null });
            if (lastSession?.session?.id) sessionIds.push(lastSession.session.id);
          }
          this._debugSessionIds = sessionIds;
          this._pushDebugStep(
            `Step 4 — competitionDivisions(${this._debugCompetitionId}) → groupSessions`,
            { stadesTotal: stades.length, ligueStade: ligueStade ? { groupement: ligueStade.groupement, phasesCount: ligueStade.phases.length } : 'NOT FOUND', groupIds, groupSessionDetails, sessionIds },
            sessionIds.length > 0 ? 'ok' : 'error'
          );
          break;
        }
        case 5: {
          const perSession: any[] = [];
          for (const sid of this._debugSessionIds) {
            const entries = await firstValueFrom(this.competitionService.debugGetSessionRanking(sid));
            perSession.push({ sessionId: sid, count: entries.length, sample: entries.slice(0, 3), rank10: entries.find((e: any) => e.rank === 10) ?? null });
          }
          this._pushDebugStep(`Step 5 — getSessionRanking (${this._debugSessionIds.length} sessions)`, {
            sessions: perSession,
          }, perSession.some(s => s.count > 0) ? 'ok' : 'error');
          break;
        }
      }
    } catch (err: any) {
      this._pushDebugStep(`Step ${this.debugStep} — ERREUR`, err?.message ?? String(err), 'error');
    }
    this.debugRunning = false;
  }

  async runAllDebugSteps(): Promise<void> {
    this.resetDebug();
    for (let i = 0; i < 5; i++) {
      await this.runNextDebugStep();
      if (this.debugStepResults.at(-1)?.status === 'error') break;
    }
  }

  private _pushDebugStep(label: string, data: any, status: 'ok' | 'error'): void {
    this.debugStepResults.push({ label, data, status });
  }

  getRecentCompetitions(): { [division: string]: Array<{ label: string; date: string; organization: string }> } {
    const recentByDivision: { [division: string]: Array<{ label: string; date: string; organization: string }> } = {};

    Object.values(this.filtered_team_results).forEach((results: CompetitionResults[]) => {
      results.forEach((res: CompetitionResults) => {
        if (this.isRecentCalculation(res.competition.calculation_date)) {
          const division = res.competition.assigned_division || 'Autres';
          if (!recentByDivision[division]) {
            recentByDivision[division] = [];
          }
          
          // Vérifier si cette compétition n'est pas déjà ajoutée
          const competitionLabel = res.competition.assigned_label ?? 'Unknown';
          const exists = recentByDivision[division].some(
            c => c.label === competitionLabel && c.date === res.competition.calculation_date
          );
          
          if (!exists) {
            recentByDivision[division].push({
              label: competitionLabel,
              date: res.competition.calculation_date || '',
              organization: this.get_organization_label(res.competition.organization_id)
            });
          }
        }
      });
    });

    return recentByDivision;
  }

  
}
