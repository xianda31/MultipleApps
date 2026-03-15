import { Component } from '@angular/core';
import { Competition, CompetitionOrganization, CompetitionResultsMap, CompetitionTeam, Player, CompetitionResults, COMPETITION_DIVISION_LABELS } from './competitions.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompetitionService } from './competition.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { TitleService } from '../../front/title/title.service';
import { ActivatedRoute } from '@angular/router';
import { UIConfiguration } from '../../common/interfaces/ui-conf.interface';
import { Member } from '../../common/interfaces/member.interface';
import { MembersService } from '../../common/services/members.service';

@Component({
  selector: 'app-competitions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './competitions.html',
  styleUrl: './competitions.scss'
})
export class CompetitionsComponent {
  current_season: string = '';
  competitions: Competition[] = [];
  organizations: CompetitionOrganization[] = [];
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
  private _members: Member[] = [];
  // nombre de jours pour considérer une calculation_date comme récente
  private readonly RECENT_CALCULATION_DAYS: number = 30;


  constructor(
    private competitionService: CompetitionService,
    private systemService: SystemDataService,
    private titleService: TitleService,
    private route: ActivatedRoute,
    private memberService: MembersService,
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
      
      const defaultLabels = { comite: 'Comité des Pyrénées', ligue: 'Ligue 06 LR-PY', national: 'FFB' };
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
      this.one_year_back =  false;
      this.competitionService.getCompetitionOrganizations(this.preferred_organization_labels).subscribe(orgs => {
        this.organizations = orgs;
      });
      
      this.show_full_team =  false;
      // this.show_infos = ui?.competitions?.show_infos || false;
      this.no_filter =  false;
      this.update_results();
      this.data_ready = true;
    });
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
      this.full_regeneration = true;
      this.update_results();
      this.full_regeneration = false;
    }
    this.thresholdsModified = true;
    this.titleService.setTitle('Résultats des compétitions ' + this.current_season);
  }

  update_results(): void {
    this.current_season = this.one_year_back ? this.systemService.previous_season(this.systemService.get_today_season()) : this.systemService.get_today_season();
    this.titleService.setTitle('Résultats des compétitions ' + this.current_season);

    this.competitionService.getCompetionsResults(this.current_season, this.preferred_organization_labels, this.full_regeneration).subscribe(results => {

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
    });
  }




  saveThresholds(): void {
    // Get the current UI config and merge thresholds before saving
    this.systemService.save_ui_settings(this.ui_config_loaded)
      .then(() => {
        this.thresholdsModified = false;
        console.log('Seuils sauvegardés:', this.ui_config_loaded.competitions.result_filter_thresholds);
      })
      .catch((err: unknown) => {
        console.error('Erreur lors de la sauvegarde des seuils:', err);
      });
  }

  get_organization_label(id: number): string {
    const org = this.organizations.find(o => o.id === id);
    if (!org) return 'Inconnu';
    // Cherche le niveau correspondant à l'organisation
    const orgLabel = org.label;
    let niveau: string | undefined = undefined;
    for (const [level, label] of Object.entries(this.preferred_organization_labels)) {
      if (label === orgLabel) {
        niveau = level;
        break;
      }
    }
    switch (niveau) {
      case 'comite':
        return 'Résultats Comité';
      case 'ligue':
        return 'Résultats Finale de Ligue';
      case 'national':
        return 'Résultats Finale Nationale';
      default:
        return 'Résultats ' + org.label;
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
      return players.filter(p => this.isMember(p));
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
      (team.cumulated_pe_percentage as any) >= +threshold
    );
  }

  /**
   * Récupère les compétitions récentes groupées par division
   */
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
