import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { Person } from '../../../../../common/ffb/interface/tournament.ffb.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { InscriptionComponent } from '../inscription/inscription.component';
import { FormsModule } from '@angular/forms';
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

  teams !: Person[][];
  constructor(
    private ffbService: FfbService
  ) { }


  ngOnInit(): void {
    this.ffbService.getTournamentTeams(this.tournamentTeamsId).then((data) => {
      this.teams = data;
    });
  }

  addTeam(event: any) {
    console.log('TeamsComponent.addTeam', event);
    let team: Person[] | null = null;
    if (event) {
      team = event;
    }
    if (team) { this.teams.push(team); }
  }



}
