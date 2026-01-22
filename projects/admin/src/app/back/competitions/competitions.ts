
import { Component } from '@angular/core';
import { Competition, CompetitionOrganization, CompetitionResultsMap, CompetitionSeason, CompetitionTeam, Player, CompetitionResults } from './competitions.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompetitionService } from './competition.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { TitleService } from '../../front/title/title.service';

@Component({
  selector: 'app-competitions',
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

  divisions: string[] = ['Division de Ligue', 'Expert', 'Performance', 'Challenge', 'Espérance'];
  division_labels: { [key: string]: string } = {
    'DN': 'Division de Ligue',
    'Expert': 'Expert',
    'Performance': 'Performance',
    'Challenge': 'Challenge',
    'Espérance': 'Espérance',

  };

  preferred_organization_labels!: { comite: string; ligue: string; national: string };
  show_members_only!: boolean;
  one_year_back!: boolean;
  show_theorical_rank!: boolean;


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
      this.one_year_back = ui?.competitions?.one_year_back || false;
      this.show_theorical_rank = ui?.competitions?.show_theorical_rank || false;

      this.competitionService.getCompetitionOrganizations(this.preferred_organization_labels).subscribe(orgs => {
        this.organizations = orgs;
      });

      this.current_season = this.one_year_back ? this.systemService.previous_season(this.systemService.get_today_season()) : this.systemService.get_today_season();
      this.titleService.setTitle('Les résultats des compétitions - Saison ' + this.current_season);

      this.competitionService.getCompetionsResults(this.current_season, this.preferred_organization_labels).subscribe(results => {
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
        this.team_results = filteredResults;

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

  hasTeamsToDisplay(results: any[]): boolean {
    return Array.isArray(results) && results.some(r => r.teams && r.teams.length > 0);
  }

  // Classement en colonne selon le label de division, ou le label de la compétition si division = 'Aucune Division'
  getDivisionCategory(divisionLabel: string | undefined, competitionLabel?: string): string {
    let labelToUse = divisionLabel;
    if (divisionLabel === 'Aucune Division' && competitionLabel) {
      labelToUse = competitionLabel;
    }
    if (!labelToUse) return 'Autres';
    const key = Object.keys(this.division_labels).find(k => labelToUse.startsWith(k));
    if (!key) return 'Autres';
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

}
