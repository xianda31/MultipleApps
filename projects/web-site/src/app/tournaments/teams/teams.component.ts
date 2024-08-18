import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Person } from '../../../../../common/ffb/interface/teams.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { InscriptionComponent } from '../inscription/inscription.component';
import { TournamentTeams } from '../../../../../common/ffb/interface/tournament_teams.interface';
@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [UpperCasePipe, CommonModule, FormsModule, InscriptionComponent],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss'
})
export class TeamsComponent implements OnInit {

  @Input() tournamentTeamsId!: number;
  toggler: boolean = false;

  tournament_teams !: TournamentTeams;
  constructor(
    private ffbService: FfbService
  ) { }


  ngOnInit(): void {
    this.ffbService.getTournamentTeams(this.tournamentTeamsId).then((data) => {
      this.tournament_teams = data!;
    })
      .catch((error) => {
        console.log('TeamsComponent.ngOnInit', error);
      });
  }

  addTeam(event: any) {
    console.log('TeamsComponent.addTeam', event);
    let team: Person[] | null = null;
    if (event) {
      team = event;
    }
    // if (team) { this.teams.push(team); }
  }



}
