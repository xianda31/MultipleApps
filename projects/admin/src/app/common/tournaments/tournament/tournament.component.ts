import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { AuthentificationService } from '../../authentification/authentification.service';
import { FFBPlayer, RegisteredTeam } from '../../ffb/interface/tournament.interface';
import { Member } from '../../interfaces/member.interface';
import { ClubMember } from '../../ffb/interface/club-member.interface';
import { PlayerEntry } from '../../ffb/interface/isolated-players.interface';
import { FormControl, Validators, FormsModule, ReactiveFormsModule, ValidationErrors, AbstractControl, FormBuilder } from '@angular/forms';
import { CommonModule, Location, UpperCasePipe } from '@angular/common';
import { TournamentService } from '../../services/tournament.service';
import { InputPlayerComponent } from '../../ffb/input-licensee/input-player.component';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom, Observable } from 'rxjs';
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
  isolated_player_count = 0;
  isolatedPlayers: PlayerEntry[] = [];
  teams: RegisteredTeam[] = [];
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
          this.teams = Array.isArray(tteams.items) ? tteams.items : [];
          this.tournament_date = tteams.tournament.date;
          this.tournament_name = tteams.tournament.title;
          this.isolated_player_count = tteams.tournament.isolatedPlayerCount || 0;
          this.already_subscribed = this.has_subscribed(this.whoAmI?.person_id);
        });

      this.TournamentService.getIsolatedPlayers(this.tteam_tournament_id)
        .subscribe({
          next: (response) => this.applyIsolatedPlayers(response),
          error: (error) => console.warn('[TournamentComponent] Impossible de charger les joueurs isolés', error)
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

  has_subscribed(person_id: number | null | undefined): boolean {
    if (person_id === undefined || person_id === null) {
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


    i_am_in_team(team: RegisteredTeam): boolean {
    const person_id = this.whoAmI?.person_id;
      if (person_id === undefined || person_id === null) return false;
    const player1PersonId = team.players[0]?.id;
    const player2PersonId = team.players[1]?.id;
    return (player1PersonId === person_id) || (player2PersonId === person_id);
  }

  i_am_isolated_player(isolatedPlayer: PlayerEntry): boolean {
    return this.whoAmI?.person_id === isolatedPlayer.person.id;
  }

  get am_i_isolated_player(): boolean {
    return this.isolatedPlayers.some((isolatedPlayer) => this.i_am_isolated_player(isolatedPlayer));
  }

  get canCreateIsolatedPlayer(): boolean {
    const personId = this.whoAmI?.person_id;
    return typeof personId === 'number' && Number.isInteger(personId) && personId > 0;
  }

  // completeTeam(player: FFBPlayer) {
  //   const me = this.whoAmI?.person_id;
  //   if (me === undefined) return;
  //   const player_pair: number[] = [player.id, me];
  //   this.createTeam(player_pair);
  // }
  subscribeWithPlayer2() {
    const me = this.whoAmI?.person_id;
    if (me === undefined || me === null) return;
    const partner: ClubMember = this.player2.value;
    if (!partner?.id) {
      this.toastService.showError('tournoi', 'Merci de sélectionner un partenaire.');
      return;
    }
    const player_pair: number[] = [me, partner.id];
    this.createTeam(player_pair);
  }

  createTeam(player_pair: number[]) {

    this.TournamentService.createTeam(this.tteam_tournament_id.toString(), player_pair)
      .then((data) => {
        this.toastService.showSuccess("tournoi du " + this.tournament_date, "vous êtes inscrit(e) en équipe");
      })
      .catch((error) => { console.log('TeamsComponent.createTeam', error); });
  }

  createIsolatedPlayer() {
    if (!this.canCreateIsolatedPlayer) {
      return;
    }

    const personId = this.whoAmI?.person_id;
    if (personId === undefined || personId === null) {
      this.toastService.showError('tournoi', 'Identifiant FFB introuvable');
      return;
    }

    this.TournamentService.createIsolatedPlayer(this.tteam_tournament_id, personId)
      .then(async (created) => {
        if (!created) {
          this.toastService.showError('tournoi', "L'inscription comme joueur isolé a été refusée");
          return;
        }

        const response = await firstValueFrom(this.TournamentService.getIsolatedPlayers(this.tteam_tournament_id));
        this.applyIsolatedPlayers(response);
        this.toastService.showSuccess('tournoi', 'vous êtes inscrit(e) comme joueur isolé');
      })
      .catch((error) => {
        console.error('[TournamentComponent] Impossible de rafraîchir les joueurs isolés', error);
        this.toastService.showWarning('tournoi', "Inscription envoyée, mais la liste n'a pas pu être actualisée");
      });
  }

  deleteTeam(team: RegisteredTeam) {
    const tournamentRegistrationId = team.tournamentRegistrationId;
    if (!tournamentRegistrationId) {
      this.toastService.showError("tournoi", "inscription d'équipe introuvable");
      return;
    }

    this.TournamentService.deleteTeam(
      this.tteam_tournament_id.toString(),
      tournamentRegistrationId.toString()
    )
      .then((deleted) => {
        if (deleted) {
          this.toastService.showSuccess("tournoi", "vous êtes désinscrit(s) !");
        } else {
          this.toastService.showError("tournoi", "la désinscription a été refusée");
        }
      })
      .catch((error) => { console.log('TeamsComponent.deleteTeam', error); });
  }

  deleteIsolatedPlayer(isolatedPlayer: PlayerEntry) {
    this.TournamentService.deleteIsolatedPlayer(this.tteam_tournament_id, isolatedPlayer.id)
      .then((deleted) => {
        if (deleted) {
          this.isolatedPlayers = this.isolatedPlayers.filter((entry) => entry.id !== isolatedPlayer.id);
          this.isolated_player_count = this.isolatedPlayers.length;
          this.toastService.showSuccess('tournoi', 'vous êtes désinscrit(e) !');
        } else {
          this.toastService.showError('tournoi', 'la désinscription a été refusée');
        }
      });
  }

  private applyIsolatedPlayers(response: { items: PlayerEntry[]; pagination: { total_items: number } }) {
    this.isolatedPlayers = response.items;
    this.isolated_player_count = response.pagination.total_items;
  }

  exit() {
    this.location.back();
  }



}