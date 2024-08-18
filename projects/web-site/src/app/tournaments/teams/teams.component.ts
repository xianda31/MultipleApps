import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Person } from '../../../../../common/ffb/interface/teams.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { TournamentTeams } from '../../../../../common/ffb/interface/tournament_teams.interface';
import { InputPlayerComponent } from '../../../../../admin-dashboard/src/app/tournaments/input-player/input-player.component';
@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [UpperCasePipe, CommonModule, FormsModule, ReactiveFormsModule, InputPlayerComponent],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss'
})
export class TeamsComponent implements OnInit {

  @Input() tournamentTeamsId!: number;


  team_creation = false;

  newTeamGroup: FormGroup = new FormGroup({
    player1: new FormControl('moi', Validators.required),
    player2: new FormControl('', Validators.required)
  });

  get player1() { return this.newTeamGroup.get('player1'); }
  get player2() { return this.newTeamGroup.get('player2'); }

  tournament !: TournamentTeams;
  constructor(
    private ffbService: FfbService
  ) { }


  listTeams() {
    this.ffbService.getTournamentTeams(this.tournamentTeamsId).then((data) => {
      this.tournament = data;
    });
  }

  ngOnInit(): void {
    this.ffbService.getTournamentTeams(this.tournamentTeamsId).then((data) => {
      this.tournament = data!;
    })
      .catch((error) => {
        console.log('TeamsComponent.ngOnInit', error);
      });
  }


  addTeam() {
    if (!this.newTeamGroup.valid) {
      console.log('TeamsComponent.addTeam', 'invalid form');
      return;
    }

    if (this.newTeamGroup.value.player1 === this.newTeamGroup.value.player2) {
      console.log('TeamsComponent.addTeam', 'same players !!!');
      return;
    }

    let licenses: string[] = [this.newTeamGroup.value.player1,
    this.newTeamGroup.value.player2];

    console.log('TeamsComponent.addTeam', this.tournamentTeamsId, licenses);


    this.ffbService.postTeam(this.tournamentTeamsId.toString(), licenses).then((data) => {
      console.log('inscription done', JSON.stringify(data));
    });
    this.listTeams();
  }



}
