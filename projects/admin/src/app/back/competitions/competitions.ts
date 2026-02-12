import { Component } from '@angular/core';
import { Competition, CompetitionOrganization, CompetitionResultsMap, CompetitionTeam, Player, CompetitionResults, COMPETITION_DIVISION_LABELS } from './competitions.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompetitionService } from './competition.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { TitleService } from '../../front/title/title.service';
import { ActivatedRoute } from '@angular/router';
import { UIConfiguration } from '../../common/interfaces/ui-conf.interface';

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
  // show_infos!: boolean;
  // full_regeneration!: boolean;
  // result_filter_thresholds: { [key: string]: number } = {};

  spinnerMessage: string = 'Recherche en cours...';
  back_office_mode: boolean = false;
  thresholdsModified: boolean = false;
  ui_config_loaded!: UIConfiguration;
  no_filter: boolean = false;
  full_regeneration: boolean = false;
  data_ready: boolean = false;


  constructor(
    private competitionService: CompetitionService,
    private systemService: SystemDataService,
    private titleService: TitleService,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {

    // Access custom route data (e.g., 'access')
    this.route.data.subscribe(data => {
      let access = data['access'];
      if (typeof access === 'undefined') {
        this.back_office_mode = false;
      } else {
        this.back_office_mode = (access === 'full');
      }
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
  onParamsChange(reload:boolean): void {

    if (reload) {
      this.results_extracted = false;
      this.update_results();
    }
    this.thresholdsModified = true;
    this.titleService.setTitle('Résultats des compétitions ' + this.current_season);
  }

  update_results(): void {
    this.current_season = this.one_year_back ? this.systemService.previous_season(this.systemService.get_today_season()) : this.systemService.get_today_season();
    this.titleService.setTitle('Résultats des compétitions ' + this.current_season);

    this.competitionService.getCompetionsResults(this.current_season, this.preferred_organization_labels, this.full_regeneration).subscribe(results => {
      if (this.ui_config_loaded.competitions.show_infos) console.log('CompetitionsComponent: received raw competition results', results);
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

      // console.log('CompetitionsComponent: received competition results', results);

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
    return player.is_member === true;
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
    if (this.no_filter) return result.teams;
    if (threshold === undefined) return result.teams;
    return result.teams.filter((team: CompetitionTeam) =>
      team.cumulated_pe_percentage === undefined || team.cumulated_pe_percentage <= threshold
    );
  }

  
}
