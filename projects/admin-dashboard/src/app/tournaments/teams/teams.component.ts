import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MembersService } from '../../members/service/members.service';
import { TournamentTeams } from '../../../../../common/ffb/interface/tournament_teams.interface';
import { InputPlayerComponent } from '../../../../../common/ffb/input-player/input-player.component';
@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [UpperCasePipe, CommonModule, FormsModule, ReactiveFormsModule, InputPlayerComponent],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss'
})
export class TeamsComponent implements OnInit {

  @Input() tournamentTeamsId!: number;


  newTeamGroup: FormGroup = new FormGroup({
    player1: new FormControl('', Validators.required),
    player2: new FormControl('', Validators.required)
  });

  get player1() { return this.newTeamGroup.get('player1'); }
  get player2() { return this.newTeamGroup.get('player2'); }

  tournament !: TournamentTeams;
  constructor(
    private ffbService: FfbService,
    private MembersService: MembersService
  ) { }


  listTeams() {
    this.ffbService.getTournamentTeams(this.tournamentTeamsId).then((data) => {
      this.tournament = data;
    });
  }

  ngOnInit(): void {
    this.listTeams();
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

  deleteTeam(teamid: number) {
    console.log('TeamsComponent.deleteTeam', teamid);
    this.tournament.teams = this.tournament.teams.filter((t) => t.id !== teamid);
    this.ffbService.deleteTeam(this.tournamentTeamsId.toString(), teamid.toString()).then((data) => {
      // console.log('TeamsComponent.deleteTeam', data);
    });
  }

  membership(license_number: number): boolean {
    let license: string = license_number.toString().padStart(8, '0');
    return this.MembersService.isMember(license);
  }

}
