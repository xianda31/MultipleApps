import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Player } from '../../ffb/interface/tournament_teams.interface';
import { FFB_proxyService } from '../../ffb/services/ffb.service';
import { Team } from '../../ffb/interface/tournament_teams.interface';
import { InputPlayerLicenseComponent } from '../../ffb/input-player/input-player-license.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '../../services/toast.service';
import { club_tournament } from '../../ffb/interface/club_tournament.interface';
import { AuthentificationService } from '../../authentification/authentification.service';
import { Member } from '../../member.interface';


// interface LicensePair { player1: string, player2: string }

@Component({
    selector: 'app-teams',
    imports: [UpperCasePipe, CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './teams.component.html',
    styleUrl: './teams.component.scss'
})
export class TeamsComponent implements OnInit {

  @Input() tournament!: club_tournament;
  @Output() subscribed = new EventEmitter<boolean>();

  teams!: Team[];
  team_creation = false;
  whoAmI: Member | null = null;

  player2: FormControl = new FormControl(null, Validators.required);

  // newTeamGroup: FormGroup = new FormGroup({
  //   player1: new FormControl('moi', Validators.required),
  //   player2: new FormControl('', Validators.required)
  // });

  // get player1() { return this.newTeamGroup.get('player1'); }
  // get player2() { return this.newTeamGroup.get('player2'); }

  // tournament !: TournamentTeams;
  constructor(
    private ffbService: FFB_proxyService,
    private modalService: NgbModal,
    private toastService: ToastService,
    private auth: AuthentificationService


  ) { }


  listTeams() {
    this.ffbService.getTournamentTeams(this.tournament.team_tournament_id).then((data) => {
      this.teams = data.teams;
    });
  }

  ngOnInit(): void {
    this.ffbService.getTournamentTeams(this.tournament.team_tournament_id)
      .then((data) => { this.teams = data!.teams; })
      .catch((error) => { console.log('TeamsComponent.ngOnInit', error); });

    this.auth.logged_member$.subscribe((member) => {
      this.whoAmI = member;
    });

  }
  completeTeam(player: Player) {
    let license_pair: string[] = [];
    license_pair.push(player.person.license_number.toString());
    license_pair.push(this.whoAmI!.license_number.toString());
    this.createTeam(license_pair);
  }
  subscribeWithPlayer2() {
    let license_pair: string[] = [];
    license_pair.push(this.whoAmI!.license_number.toString());
    license_pair.push(this.player2.value.toString());
    this.createTeam(license_pair);

  }

  createTeam(license_pair: string[]) {

    console.log('TeamsComponent.createTeam', this.tournament.team_tournament_id.toString(), license_pair);


    // this.ffbService.postTeam(this.tournament.team_tournament_id.toString(), license_pair)
    //   .then((data) => {
    //     console.log('inscription done', JSON.stringify(data));
    //     this.toastService.showSuccess("tournoi","paire enregistrée");
    //     this.listTeams();
    //   })
    //   .catch((error) => { console.log('TeamsComponent.createTeam', error); });

    this.subscribed.emit(true);
  }

  exit() {
    this.subscribed.emit(false);
  }








  // modal(isolated_player: Player | null): Promise<LicensePair | null> {
  //   const modalRef = this.modalService.open(TeamRegistrationComponent, { centered: true });
  //   modalRef.componentInstance.tournament = this.tournament;
  //   modalRef.componentInstance.isolated_player = isolated_player;
  //   console.log('isolated_player', isolated_player);
  //   return modalRef.result as Promise<LicensePair | null>;
  // }


  // addTeam(isolated_player: Player | null) {
  //   this.modal(isolated_player).then((licenses) => {
  //     if (licenses) {
  //       console.log('licenses', licenses);
  //       let _licenses = [licenses.player1, licenses.player2];
  //       console.log('TeamsComponent.addTeam', this.tournament.team_tournament_id.toString(), _licenses);
  //       // this.ffbService.postTeam(this.tournament.team_tournament_id.toString(), licenses).then((data) => {
  //       //   console.log('inscription done', JSON.stringify(data));
  //       // });
  //       this.listTeams();
  //     }
  //   });

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


}



