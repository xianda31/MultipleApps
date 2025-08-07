import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { TournamentTeams } from '../../ffb/interface/tournament_teams.interface';
import { TitleService } from '../../../front/title.service';
import { AuthentificationService } from '../../authentification/authentification.service';

@Component({
  selector: 'app-tournaments',
  imports: [RouterModule, CommonModule],
  templateUrl: './tournaments.component.html',
  styleUrls: ['./tournaments.component.scss']
})
export class TournamentsComponent {

  next_tournament_teams: TournamentTeams[] = [];
  license_nbr = 0; // License number of the logged member
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tournamentService: TournamentService,
    private auth: AuthentificationService,
    private titleService: TitleService
  ) { }

  ngOnInit(): void {

    this.titleService.setTitle('Les Tournois');
    this.loadTournamentTeams();

    this.auth.logged_member$.subscribe((member) => {
      const whoAmI = member;
      this.license_nbr = whoAmI ? Number(whoAmI.license_number) : 0;
      console.log('Logged member license number:', this.license_nbr);
    });

  }


  loadTournamentTeams() {
    this.tournamentService.list_next_tournament_teams().subscribe((next_tournament_teams: TournamentTeams[]) => {
      this.next_tournament_teams = next_tournament_teams;
    });
  }

  date_of(tTeams: TournamentTeams): string {
    return tTeams.subscription_tournament.organization_club_tournament.date;
  }
  name_of(tTeams: TournamentTeams): string {
    return tTeams.subscription_tournament.organization_club_tournament.tournament_name;
  }
  icon_for(tTeams: TournamentTeams): string {
    const _name = tTeams.subscription_tournament.organization_club_tournament.tournament_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
    if (_name.includes('roy')) return 'bi bi-award';
    if (_name.includes('eleve')) return 'bi bi-mortarboard-fill';
    return '';
  }

  registrated_in(tTeams: TournamentTeams): boolean {

    if (!this.license_nbr) {
      return false; // If no license number is set, return false
    }
    for (let team of tTeams.teams) {
      if ((team.players[0].person.license_number === this.license_nbr)
        || (team.players[1]?.person.license_number === this.license_nbr)) {
        return true;
      }
    }
    return false;
  }

  // tournamentClass(name: string): { card: string, icon: string } {
  //   const _class = "card my-1 mx-sm-2 tournament-card h-100";
  //   // Normalisation pour enlever les accents
  //   const _name = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
  //   if (_name.includes('roy')) return { card: _class + 'border-primary', icon: 'bi bi-award' };
  //   if (_name.includes('eleve')) return { card: _class + 'border-success', icon: 'bi bi-mortarboard-fill' };
  //   return { card: _class, icon: '' };
  // }

  goToTournamentTeams(tournamentTeams: TournamentTeams) {
    this.router.navigate(['.', tournamentTeams.subscription_tournament.id],
      { relativeTo: this.route });
  }
}
