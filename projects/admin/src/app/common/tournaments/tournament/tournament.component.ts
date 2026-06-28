import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { AuthentificationService } from '../../authentification/authentification.service';
import { TeamItem } from '../../ffb/interface/team-search.interface';
import { FFBPlayer } from '../../ffb/interface/team-search.interface';
import { Member } from '../../interfaces/member.interface';
import { ClubMember } from '../../ffb/interface/club-member.interface';
import { FormControl, Validators, FormsModule, ReactiveFormsModule, ValidationErrors, AbstractControl, FormBuilder } from '@angular/forms';
import { CommonModule, Location, UpperCasePipe } from '@angular/common';
import { TournamentService } from '../../services/tournament.service';
import { InputPlayerComponent } from '../../ffb/input-licensee/input-player.component';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-tournament',
  standalone: true,
  imports: [UpperCasePipe, InputPlayerComponent, CommonModule, FormsModule, ReactiveFormsModule, NgbTooltipModule],
  templateUrl: './tournament.component.html',
  styleUrl: './tournament.component.scss'
})
export class TournamentComponent implements OnInit {


  tteam_tournament_id!: string;
  tournament_name = '';
  tournament_date = '';
  teams: TeamItem[] = [];
  whoAmI: Member | null = null;
  already_subscribed = false;
  is_member$!: Observable<boolean>;
  player2!: FormControl;

  constructor(
    private TournamentService: TournamentService,
    private toastService: ToastService,
    private auth: AuthentificationService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private location: Location) { }
  ngOnInit(): void {

    this.route.paramMap.subscribe(params => {
      this.tteam_tournament_id = params.get('tournament_id') || '';
      this.TournamentService.getTournamentTeams(this.tteam_tournament_id)
        .subscribe((tteams) => {
          this.teams = tteams.items;
          this.tournament_date = tteams.subscription_tournament.organization_club_tournament.date;
          this.tournament_name = tteams.subscription_tournament.organization_club_tournament.tournament_name;
          this.already_subscribed = this.has_subscribed(this.whoAmI?.person_id);
        });
    });


    this.auth.logged_member$.subscribe((member) => {
      this.whoAmI = member;
      this.already_subscribed = this.has_subscribed(this.whoAmI?.person_id);
    });

    this.player2 = this.fb.control(null, [Validators.required, this.player2_validator]);

    this.is_member$ = this.auth.logged_member$.pipe(
      map((member) => { return member !== null; })
    );

  }

  player2_validator = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null; // Allow empty (not yet selected)
    const clubMember = control.value as ClubMember;
    const personId = clubMember.id;
    if (this.has_subscribed(personId)) {
      return { 'already_engaged': true };
    }
    return null;
  }

  has_subscribed(person_id: number | undefined): boolean {
    if (person_id === undefined) {
      return false;
    }
    if (this.teams === undefined) {
      return false;
    }

    for (let team of this.teams) {
      const player1PersonId = team.players[0]?.id;
      const player2PersonId = team.players[1]?.id;
      if ((player1PersonId === person_id) || (player2PersonId === person_id)) {
        return true;
      }
    }
    return false;
  }

  // is_in_team(person_id: number | undefined, team: TeamItem): boolean {
  //   if (person_id === undefined) return false;
  //   const player1PersonId = team.players[0]?.id;
  //   const player2PersonId = team.players[1]?.id;
  //   return (player1PersonId === person_id) || (player2PersonId === person_id);
  // }
    i_am_in_team(team: TeamItem): boolean {
    const person_id = this.whoAmI?.person_id;
    if (person_id === undefined) return false;
    const player1PersonId = team.players[0]?.id;
    const player2PersonId = team.players[1]?.id;
    return (player1PersonId === person_id) || (player2PersonId === person_id);
  }

  completeTeam(player: FFBPlayer) {
    let player_pair: string[] = [];
    player_pair.push(player.id.toString());
    player_pair.push(this.whoAmI!.person_id?.toString() || '');
    this.createTeam(player_pair);
  }
  subscribeWithPlayer2() {
    let player_pair: string[] = [];
    player_pair.push(this.whoAmI!.person_id?.toString() || '');
    const clubMember = this.player2.value as ClubMember;
    player_pair.push(clubMember.id.toString());
    this.createTeam(player_pair);
  }

  subscribeSolo() {
    let player_pair: string[] = [];
    player_pair.push(this.whoAmI!.person_id?.toString() || '');
    this.createTeam(player_pair, 'solo');
  }

  createTeam(player_pair: string[], solo?: string) {

    this.TournamentService.createTeam(this.tteam_tournament_id.toString(), player_pair)
      .then((data) => {
        const msg = (solo === 'solo') ? "vous êtes inscrit(e) en solo" : "vous êtes inscrit(e) en équipe";
        this.toastService.showSuccess("tournoi du " + this.tournament_date, msg);
      })
      .catch((error) => { console.log('TeamsComponent.createTeam', error); });
  }

  deleteTeam(team: TeamItem) {

    this.TournamentService.deleteTeam(this.tteam_tournament_id.toString(), team.id.toString())
      .then((data) => {
        this.toastService.showSuccess("tournoi", "vous êtes désinscrit(s) !");
      })
      .catch((error) => { console.log('TeamsComponent.deleteTeam', error); });
  }

  exit() {
    this.location.back();
  }



}