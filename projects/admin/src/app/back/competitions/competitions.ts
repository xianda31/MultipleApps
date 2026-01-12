

import { Component } from '@angular/core';
import { Competition, CompetitionSeason, CompetitionTeam, Player } from './competitions.interface';
import { MembersService } from '../../common/services/members.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Member } from '../../common/interfaces/member.interface';
import { CompetitionService } from './competition.service';

@Component({
  selector: 'app-competitions',
  imports: [CommonModule, FormsModule],
  templateUrl: './competitions.html',
  styleUrl: './competitions.scss'
})
export class CompetitionsComponent {
  seasons: CompetitionSeason[] = [];
  competitions: Competition[] = [];
  selected_season: CompetitionSeason | null = null;
  preferred_organizations: string[] = ['FFB', 'Ligue 06 LR-PY', 'Comité des Pyrenees']
  results_extracted: boolean = false;
  // Map des résultats par compétition
  team_results: { [competitionId: number]: {competition: Competition, teams: CompetitionTeam[]} } = {};
  labels: string[] = ['DN4', 'Expert', 'Performance', 'Challenge'];
  spinnerMessage: string = 'Recherche en cours...';
  members: Member[] = [];

  constructor(
    private competitionService: CompetitionService
  ) { }

  ngOnInit(): void {

    this.competitionService.getCompetionsResults('2025/2026').subscribe(results => {
      // console.log('Résultats des compétitions pour la saison 2025-2026', results);
      this.team_results = results;
      // Ne garder que les compétitions ayant au moins une équipe avec au moins un joueur
      this.competitions = Object.values(results)
        .filter(r => Array.isArray(r.teams) && r.teams.some((team: any) => Array.isArray(team.players) && team.players.length > 0))
        .map(r => r.competition);
      this.results_extracted = true;
    });
  }



  isMember(player: Player): boolean {
    return player.is_member === true;
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
      if (this.labels.includes(comp.division?.label)) {
        columns[comp.division.label].push(comp);
      } else {
        columns['Autres'].push(comp);
      }
    }
    return columns;
  }
}
