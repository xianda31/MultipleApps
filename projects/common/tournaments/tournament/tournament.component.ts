import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../toaster/toast.service';
import { AuthentificationService } from '../../authentification/authentification.service';
import { FfbService } from '../../ffb/services/ffb.service';
import { Player, Team, TournamentTeams } from '../../ffb/interface/tournament_teams.interface';
import { Member } from '../../members/member.interface';
import { FormControl, Validators, Form, FormsModule, ReactiveFormsModule, ValidationErrors, AbstractControl } from '@angular/forms';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { InputPlayerComponent } from '../../ffb/input-player/input-player.component';
import { BehaviorSubject, combineLatest, from, map, Observable, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-tournament',
  standalone: true,
  imports: [UpperCasePipe, InputPlayerComponent, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './tournament.component.html',
  styleUrl: './tournament.component.scss'
})
export class TournamentComponent implements OnInit {

  team_tournament_id!: number;
  tournament_name = '';
  teams!: Team[];
  team_update$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  whoAmI: Member | null = null;
  subscription_authorized = false;
  player2: FormControl = new FormControl(null, Validators.required);

  constructor(
    private ffbService: FfbService,
    private toastService: ToastService,
    private auth: AuthentificationService,
    private route: ActivatedRoute,
    private router: Router
  ) { }
  ngOnInit(): void {

    this.player2.setValidators([this.player2_validator]);

    this.route.queryParams.subscribe((params) => {
      this.team_tournament_id = params['team_tournament_id'];
      this.tournament_name = params['tournament_name'];
      let tournament_teams$: Observable<TournamentTeams> = from(this.ffbService.getTournamentTeams(this.team_tournament_id));

      combineLatest([this.team_update$, this.auth.logged_member$]).pipe(
        switchMap(([team_updated, member]) => {
          this.whoAmI = member;
          return from(this.ffbService.getTournamentTeams(this.team_tournament_id))
        }))
        .subscribe((t_teams) => {
          this.teams = t_teams.teams;
          if (this.whoAmI == null) {
            this.subscription_authorized = false;
            console.log('oups ! on ne devrait pas être là');
          } else {
            this.subscription_authorized = !this.has_subscribed(Number(this.whoAmI.license_number));
          }
          console.log('%s équipes ;  %s ; subscript. :', this.teams.length, this.whoAmI?.lastname, this.subscription_authorized);
        });


      // combineLatest([tournament_teams$, this.auth.logged_member$, this.team_update$])
      //   .subscribe(([t_teams, member, team_update]) => {
      //     this.teams = t_teams.teams;
      //     console.log('TournamentComponent.ngOnInit', this.teams.length, member, team_update);
      //     if (member == null) {
      //       this.subscription_authorized = false;
      //       console.log('oups ! on ne devrait pas être là');
      //     } else {
      //       this.subscription_authorized = !this.has_subscribed(Number(member.license_number));
      //       this.whoAmI = member;
      //     }
      //   });

    });
  }

  player2_validator = (control: AbstractControl): ValidationErrors | null => {
    if (this.has_subscribed(Number(control.value))) {
      return { 'already_engaged': true };
    }
    return null;
  }

  has_subscribed(license_nbr: number): boolean {
    if (this.teams === undefined) {
      console.log('TeamsComponent.has_subscribed', 'no teams');
      return false;
    }

    for (let team of this.teams) {
      if ((team.players[0].person.license_number === license_nbr)
        || (team.players[1]?.person.license_number === license_nbr)) {
        return true;
      }
    }
    return false;
  }

  is_in_team(license: string | undefined, team: Team): boolean {
    if (license === undefined) return false;
    let license_nbr: number = Number(license);
    return ((team.players[0].person.license_number === license_nbr) || (team.players[1]?.person.license_number === license_nbr));
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

  subscribeSolo() {
    let license_pair: string[] = [];
    license_pair.push(this.whoAmI!.license_number.toString());
    this.createTeam(license_pair);
  }

  createTeam(license_pair: string[]) {
    console.log('TeamsComponent.createTeam', this.team_tournament_id.toString(), license_pair);
    this.ffbService.postTeam(this.team_tournament_id.toString(), license_pair)
      .then((data) => {
        this.toastService.showSuccessToast("tournoi", "enregistré !");
        this.team_update$.next(true);
      })
      .catch((error) => { console.log('TeamsComponent.createTeam', error); });
  }

  deleteTeam(team: Team) {

    this.ffbService.deleteTeam(this.team_tournament_id.toString(), team.id.toString())
      .then((data) => {
        this.toastService.showSuccessToast("tournoi", "supprimé !");
        this.team_update$.next(true);
      })
      .catch((error) => { console.log('TeamsComponent.deleteTeam', error); });
  }

  exit() {
    this.router.navigate(['/tournaments']);
  }



}