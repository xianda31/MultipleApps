import { Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { AuthentificationService } from '../../authentification/authentification.service';
import { Player, Team } from '../../ffb/interface/tournament_teams.interface';
import { Member } from '../../member.interface';
import { FormControl, Validators, FormsModule, ReactiveFormsModule, ValidationErrors, AbstractControl, FormBuilder } from '@angular/forms';
import { CommonModule, Location, UpperCasePipe } from '@angular/common';
import { TournamentService } from '../../services/tournament.service';
import { InputPlayerLicenseComponent } from '../../ffb/input-player/input-player-license.component';
import { combineLatest, Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-tournament',
  imports: [UpperCasePipe, InputPlayerLicenseComponent, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './tournament.component.html',
  styleUrl: './tournament.component.scss'
})
export class TournamentComponent implements OnInit {

  // @Input('id') tteam_tournament_id!: string;

  tteam_tournament_id!: string;
  tournament_name = '';
  tournament_date = '';
  teams: Team[] = [];
  // teams$: Observable<Team[]> = new Observable<Team[]>();
  // team_update$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
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
    private router: Router,
    private location: Location
  ) { }
  ngOnInit(): void {

    this.route.paramMap.subscribe(params => {
        this.tteam_tournament_id = params.get('id') || '';
        this.TournamentService.getTournamentTeams(this.tteam_tournament_id)
          .subscribe((tteams) => {
            this.teams = tteams.teams;
            this.tournament_date = tteams.subscription_tournament.organization_club_tournament.date;
            this.tournament_name = tteams.subscription_tournament.organization_club_tournament.tournament_name;
            this.already_subscribed = this.has_subscribed(Number(this.whoAmI?.license_number));
          });
      });

    // this.tteam_tournament_id = this.route.snapshot.paramMap.get('id') || '';


    this.auth.logged_member$.subscribe((member) => {
      this.whoAmI = member;
      this.already_subscribed = this.has_subscribed(Number(this.whoAmI?.license_number));

    });

    this.player2 = this.fb.control(null, [Validators.required, this.player2_validator]);

    this.is_member$ = this.auth.logged_member$.pipe(
      map((member) => { return member !== null; })
    );

  }

  player2_validator = (control: AbstractControl): ValidationErrors | null => {
    if (this.has_subscribed(Number(control.value))) {
      return { 'already_engaged': true };
    }
    return null;
  }

  has_subscribed(license_nbr: number): boolean {
    if (this.teams === undefined) {
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
    this.createTeam(license_pair, 'solo');
  }

  createTeam(license_pair: string[], solo?: string) {

    this.TournamentService.createTeam(this.tteam_tournament_id.toString(), license_pair)
      .then((data) => {
        const msg = (solo === 'solo') ? "vous êtes inscrit(e) en solo" : "vous êtes inscrit(e) en équipe";
        this.toastService.showSuccess("tournoi du " + this.tournament_date, msg);
        // this.team_update$.next(true);
      })
      .catch((error) => { console.log('TeamsComponent.createTeam', error); });
  }

  deleteTeam(team: Team) {

    this.TournamentService.deleteTeam(this.tteam_tournament_id.toString(), team.id.toString())
      .then((data) => {
        this.toastService.showSuccess("tournoi", "vous êtes désinscrit(s) !");
        // this.team_update$.next(true);
      })
      .catch((error) => { console.log('TeamsComponent.deleteTeam', error); });
  }

  exit() {
    // this.location.back();
    this.router.navigate(['front']);
  }



}