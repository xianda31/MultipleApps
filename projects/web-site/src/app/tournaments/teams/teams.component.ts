import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Person, Player } from '../../../../../common/ffb/interface/teams.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { Team, TournamentTeams } from '../../../../../common/ffb/interface/tournament_teams.interface';
import { InputPlayerComponent } from '../../../../../common/ffb/input-player/input-player.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TeamRegistrationComponent } from '../../modals/team-registration/team-registration.component';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { club_tournament } from '../../../../../common/ffb/interface/club_tournament.interface';
@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [UpperCasePipe, CommonModule, FormsModule, ReactiveFormsModule, InputPlayerComponent],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss'
})
export class TeamsComponent implements OnInit {

  @Input() tournament!: club_tournament;

  teams!: Team[];
  team_creation = false;

  newTeamGroup: FormGroup = new FormGroup({
    player1: new FormControl('moi', Validators.required),
    player2: new FormControl('', Validators.required)
  });

  get player1() { return this.newTeamGroup.get('player1'); }
  get player2() { return this.newTeamGroup.get('player2'); }

  // tournament !: TournamentTeams;
  constructor(
    private ffbService: FfbService,
    private modalService: NgbModal,
    private toastService: ToastService


  ) { }


  listTeams() {
    this.ffbService.getTournamentTeams(this.tournament.team_tournament_id).then((data) => {
      this.teams = data.teams;
    });
  }

  ngOnInit(): void {
    this.ffbService.getTournamentTeams(this.tournament.team_tournament_id).then((data) => {
      this.teams = data!.teams;
    })
      .catch((error) => {
        console.log('TeamsComponent.ngOnInit', error);
      });
  }


  modal(isolated_player: Player | null): Promise<string[] | null> {
    const modalRef = this.modalService.open(TeamRegistrationComponent, { centered: true });
    modalRef.componentInstance.tournament = this.tournament;
    modalRef.componentInstance.isolated_player = isolated_player;
    console.log('isolated_player', isolated_player);
    return modalRef.result as Promise<string[] | null>;
  }


  addTeam(isolated_player: Player | null) {
    this.modal(isolated_player).then((team) => {
      if (team) {
        console.log('TeamsComponent.addTeam', team);
        // this.teams.push(team);
      }
    });

    // if (!this.newTeamGroup.valid) {
    //   console.log('TeamsComponent.addTeam', 'invalid form');
    //   return;
    // }

    // if (this.newTeamGroup.value.player1 === this.newTeamGroup.value.player2) {
    //   console.log('TeamsComponent.addTeam', 'same players !!!');
    //   return;
    // }

    // let licenses: string[] = [this.newTeamGroup.value.player1,
    // this.newTeamGroup.value.player2];

    // console.log('TeamsComponent.addTeam', this.tournamentTeamsId, licenses);


    // this.ffbService.postTeam(this.tournamentTeamsId.toString(), licenses).then((data) => {
    //   console.log('inscription done', JSON.stringify(data));
    // });
    // this.listTeams();
  }



}
