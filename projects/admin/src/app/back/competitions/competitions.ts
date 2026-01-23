import { Component } from '@angular/core';
import { Competition, CompetitionOrganization, CompetitionResultsMap, CompetitionTeam, Player, CompetitionResults } from './competitions.interface';
import { COMPETITION_DIVISIONS, COMPETITION_DIVISION_LABELS } from '../../common/interfaces/ui-conf.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompetitionService } from './competition.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { TitleService } from '../../front/title/title.service';

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

  divisions: string[] = COMPETITION_DIVISIONS;
  division_labels: { [key: string]: string } = COMPETITION_DIVISION_LABELS;

  preferred_organization_labels!: { comite: string; ligue: string; national: string };
  show_members_only!: boolean;
  one_year_back!: boolean;
  show_infos!: boolean;
  full_regeneration!: boolean;
  result_filter_thresholds: { [key: string]: number } = {};

  spinnerMessage: string = 'Recherche en cours...';

  constructor(
    private competitionService: CompetitionService,
    private systemService: SystemDataService,
    private titleService: TitleService
  ) { }

  ngOnInit(): void {

    // Charger la configuration Competitions depuis ui-conf
    this.systemService.get_ui_settings().subscribe(ui => {
      if (ui?.competitions?.preferred_organizations && typeof ui.competitions.preferred_organizations === 'object') {
        this.preferred_organization_labels = ui.competitions.preferred_organizations;
      } else {
        this.preferred_organization_labels = { comite: 'Comité des Pyrénées', ligue: 'Ligue 06 LR-PY', national: 'FFB' };
      }
      this.show_members_only = ui?.competitions?.show_members_only || false;
      this.show_infos = ui?.competitions?.show_infos || false;
      this.full_regeneration = ui?.competitions?.full_regeneration ?? false;
      this.result_filter_thresholds = ui?.competitions?.result_filter_thresholds || {};

      this.competitionService.getCompetitionOrganizations(this.preferred_organization_labels).subscribe(orgs => {
        this.organizations = orgs;
      });

      this.current_season = this.one_year_back ? this.systemService.previous_season(this.systemService.get_today_season()) : this.systemService.get_today_season();
      this.titleService.setTitle('Les résultats des compétitions - Saison ' + this.current_season);

      this.competitionService.getCompetionsResults(this.current_season, this.preferred_organization_labels, this.full_regeneration).subscribe(results => {
        if(this.show_infos) console.log('CompetitionsComponent: received raw competition results', results);
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

        // console.log('CompetitionsComponent: received competition results', results);

        this.results_extracted = true;
      });
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


  // Classement en colonne selon le label de division, ou le label de la compétition si division = 'Aucune Division'
  getDivisionCategory(divisionLabel: string | undefined, competitionLabel?: string): string {
    let labelToUse = divisionLabel;
    if (divisionLabel === 'Aucune Division' && competitionLabel) {
      labelToUse = competitionLabel;
    }
    if (!labelToUse) {
      console.warn('getDivisionCategory: divisionLabel et competitionLabel non définis, retour "Autres"');
      return 'Autres';
    }
    const key = Object.keys(this.division_labels).find(k => labelToUse.startsWith(k));
    if (!key) {
      console.warn('getDivisionCategory: labelToUse ne correspond à aucune division connue, retour "Autres"', labelToUse);
      return 'Autres';
    }
    return this.division_labels[key] || 'Autres';
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
    if (this.show_members_only) {
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
    const divisionLabel = this.getDivisionCategory(competition?.division?.label, competition?.label);
    return this.result_filter_thresholds[divisionLabel];
  }

  getFilteredTeams(result: CompetitionResults): CompetitionTeam[] {
    if (!result || !Array.isArray(result.teams)) return [];
    const threshold = this.getThreshold(result.competition);
    if (threshold === undefined) return result.teams;
    return result.teams.filter((team: CompetitionTeam) =>
      team.cumulated_pe_percentage === undefined || team.cumulated_pe_percentage <= threshold
    );
  }
}
