

import { Component } from '@angular/core';
import { Competition, CompetitionSeason, CompetitionTeam, Player } from './competitions.interface';
import { MembersService } from '../../common/services/members.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Member } from '../../common/interfaces/member.interface';
import { CompetitionService } from './competition.service';
import { map, switchMap, tap } from 'rxjs';
import { of } from 'rxjs';

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
  team_results: { [competitionId: number]: CompetitionTeam[] } = {};
  labels: string[] = ['DN4', 'Expert', 'Performance', 'Challenge'];
  spinnerMessage: string = 'Analyse en cours...';
  members: Member[] = [];

  constructor(
    private memberService: MembersService,
    private competitionService: CompetitionService
  ) { }

  ngOnInit(): void {
    this.memberService.listMembers().subscribe(members => {
      this.members = members;
    });

    this.competitionService.getCurrentCompetitionSeason().pipe(
      tap((season) => {
        this.selected_season = season;
        console.log('Current season', this.selected_season?.name);
      }),
      switchMap((season) => {
        if (!season) return of([]);
        return this.competitionService.getCompetitions(String(season.id));
      }),
      map((competitions: Competition[]) => {
        this.competitions = competitions.filter(c => c.allGroupsProbated === true);
        // Ne garder que les compétitions ayant au moins un résultat d'équipe
        console.log('Compétitions terminées avec résultats', this.competitions);
        return this.competitions;
      }),
      switchMap(async (competitions: Competition[]) => {
        if (!competitions.length) return [];
        const results = [];
        // le serveur FFB est lent, on fait les appels en séquence
        for (const comp of competitions) {
          this.spinnerMessage = `... ${comp.label}...`;
          const teams = await this.competitionService.getCompetitionResults(String(comp.id)).toPromise();
          const filteredResults = (teams || []).filter((team: any) => this.has_a_member(team.players));
          if (filteredResults.length > 0) {
            console.log(`Results loaded for competition ${comp.label}`, filteredResults);
            results.push({ competitionId: comp.id, filteredResults });
          }
        }
        return results;
      })
    ).subscribe((competitionResults: any[]) => {
      // Remplir team_results pour chaque compétition
      (competitionResults || []).forEach((r: any) => {
        this.team_results[r.competitionId] = r.filteredResults;
      });
      // competitions reste la liste des objets Competition filtrés
      console.log('Résultats des compétitions pour la saison', this.selected_season?.name, this.competitions);
      this.results_extracted = true;
    });


  }


  has_a_member(players: Player[]): boolean {
    const member1 = this.members.find(m => players.some(p => p.license_number === m.license_number));
    const member2 = this.members.find(m => players.some(p => p.license_number === m.license_number));
    return member1 !== undefined || member2 !== undefined;
  }

  isMember(player: Player): boolean {
    return this.members.some(m => m.license_number === player.license_number);
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
