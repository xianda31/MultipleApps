

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
  current_season: string = '' ;
  competitions: Competition[] = [];
  organizations: CompetitionOrganization[] = [];
  results_extracted: boolean = false;
  team_results: CompetitionResultsMap = {};

  divisions: string[] = ['National', 'Expert', 'Performance', 'Challenge', 'Accession'];
  division_labels: { [key: string]: string } = {
    'DN3': 'National',
    'DN4': 'National',
    'Expert': 'Expert',
    'Performance': 'Performance',
    'Challenge': 'Challenge',
    'Aucune Division': 'Accession'
    
  };

  preferred_organization_labels!: string[] ; 
  show_members_only!: boolean ;
  one_year_back!: boolean ;
  show_theorical_rank!: boolean ;

  
  spinnerMessage: string = 'Recherche en cours...';
  
  constructor(
    private competitionService: CompetitionService,
    private systemService: SystemDataService,
    private titleService: TitleService
  ) { }

  ngOnInit(): void {

    // Charger la configuration Competitions depuis ui-conf
    this.systemService.get_ui_settings().subscribe(ui => {
      // this.loadCompetitionConfigFromUi(ui);
      this.preferred_organization_labels = ui?.competitions?.preferred_organizations || ['FFB', 'Ligue 06 LR-PY', 'Comité des Pyrenees'];
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
       
        console.log('CompetitionsComponent: received competition results', results);
        

          this.results_extracted = true;
      });
    });
  }

  get_organization_label(id: number): string {
    const org = this.organizations.find(o => o.id === id);
    return 'classement ' + (org ? org.label : 'Inconnu') ;
  }

    hasTeamsToDisplay(results: any[]): boolean {
    return Array.isArray(results) && results.some(r => r.teams && r.teams.length > 0);
  }

  getDivisionCategory(label: string | undefined): string {
    if (!label) return 'Accession';
    return this.division_labels[label] || 'Accession';
  }

  
  // Section de configuration acquise depuis UI settings
  private loadCompetitionConfigFromUi(ui: any) {
    if (ui?.competitions) {
      if (Array.isArray(ui.competitions.preferred_organizations)) {
        this.preferred_organization_labels = ui.competitions.preferred_organizations;
      }
      if (typeof ui.competitions.show_members_only === 'boolean') {
        this.show_members_only = ui.competitions.show_members_only;
      }
      if (typeof ui.competitions.one_year_back === 'boolean') {
        this.one_year_back = ui.competitions.one_year_back;
      }
      if (typeof ui.competitions.show_theorical_rank === 'boolean') {
        this.show_theorical_rank = ui.competitions.show_theorical_rank;
      }
    }
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
