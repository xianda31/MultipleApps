

import { Component } from '@angular/core';
import { Competition, CompetitionOrganization, CompetitionResultsMap, CompetitionSeason, CompetitionTeam, Player } from './competitions.interface';
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

  divisions: string[] = ['DN4', 'Expert', 'Performance', 'Challenge'];

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
      console.log('CompetitionsComponent: loaded competition UI config from system data service', {
        preferred_organization_labels: this.preferred_organization_labels,
        show_members_only: this.show_members_only,
        one_year_back: this.one_year_back,
        show_theorical_rank: this.show_theorical_rank
      });

      this.competitionService.getCompetitionOrganizations(this.preferred_organization_labels).subscribe(orgs => {
        this.organizations = orgs;
        console.log('CompetitionsComponent: loaded competition organizations', orgs);
      });
      
      this.current_season = this.one_year_back ? this.systemService.previous_season(this.systemService.get_today_season()) : this.systemService.get_today_season();
      this.titleService.setTitle('Les résultats des compétitions - Saison ' + this.current_season);

      this.competitionService.getCompetionsResults(this.current_season, this.preferred_organization_labels).subscribe(results => {
        this.team_results = results;
        console.log('CompetitionsComponent: received competition results', results);
        // Ne garder que les compétitions  ayant au moins une équipe avec au moins un joueur
        // this.competitions = Object.values(results)
        //   .flat()
        //   .filter(r => Array.isArray(r.teams) && r.teams.some((team: any) => Array.isArray(team.players) && team.players.length > 0))
        //   .map(r => r.competition);

        //   console.log(`CompetitionsComponent: loaded ${this.competitions.length} competitions with results for season ${this.current_season}`);
        //   console.log(this.competitions);

          // this.competitions.forEach(async comp => {
          //   this.competitionService.getCompetitionStatus(comp.id.toString()).subscribe(statusData => {
          //     if (statusData) {
          //       console.log(`Competition ${comp.id} with phases data:`, statusData.phases);
          //     } else {
          //       console.log(`No status data available for competition ${comp.id}`);
          //     }
          //   });
          // });

          this.results_extracted = true;
      });
    });
  }

  get_organization_label(id: number): string {
    const org = this.organizations.find(o => o.id === id);
    return org ? org.label : 'Inconnu';
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

  get competitionsByDivision() {
    const columns: { [label: string]: Competition[] } = {
      DN4: [],
      Expert: [],
      Performance: [],
      Challenge: [],
      Autres: []
    };
    for (const comp of this.competitions) {
      if(this.team_results[comp.id] === undefined) {
        continue; // Skip competitions without results
      }
      if (this.divisions.includes(comp.division?.label)) {
        columns[comp.division.label].push(comp);
      } else {
        columns['Autres'].push(comp);
      }
    }
    return columns;
  }
  
    isMember(player: Player): boolean {
      return player.is_member === true;
    }
  
    // pe(player: Player): number {
    //   const pe = player.pe + player.pe_bonus + player.pe_extra;
    //   // const pp = player.pp + player.pp_bonus + player.pp_extra;
    //   return pe;
    // }

      getDisplayedPlayers(players: Player[]): Player[] {
    if (this.show_members_only) {
      return players.filter(p => this.isMember(p));
    }
    return players;
  }

}
