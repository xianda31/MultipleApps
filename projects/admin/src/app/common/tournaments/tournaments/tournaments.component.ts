import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { TournamentTeams } from '../../ffb/interface/tournament_teams.interface';
import { AuthentificationService } from '../../authentification/authentification.service';
import { TitleService } from '../../../front/title/title.service';
import { BreakpointsSettings } from '../../interfaces/system-conf.interface';
import { formatRowColsClasses } from '../../utils/ui-utils';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './tournaments.component.html',
  styleUrls: ['./tournaments.component.scss']
})
export class TournamentsComponent {
  @Input() displayTitle: boolean = true;
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 }; 

  
  next_tournament_teams: TournamentTeams[] = [];

  license_nbr = 0; // License number of the logged member
  logged: boolean = false;

  constructor(
    private tournamentService: TournamentService,
    private auth: AuthentificationService,
    private router: Router,
    private route: ActivatedRoute,
    private titleService: TitleService

  ) { }



  ngOnInit(): void {

    if(this.displayTitle) this.titleService.setTitle('Les prochains tournois de régularité');
    this.loadTournamentTeams();

    this.auth.logged_member$.subscribe((member) => {
      const whoAmI = member;
      this.license_nbr = whoAmI ? Number(whoAmI.license_number) : 0;
      this.logged = !!whoAmI;
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
    if (_name.includes('accession')) return 'bi bi-mortarboard-fill';
    if (_name.includes('regularite')) return 'bi bi-gear-fill';
    if (_name.includes('coupe')) return 'bi bi-trophy-fill';
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

  selectTournament(tournamentId: number) {
    this.router.navigate(['/front/tournaments', tournamentId],
      { relativeTo: this.route });
  }

  // Compute bootstrap row classes from the `row_cols` input (breakpoints settings).
  rowCols(): string[] {
    return formatRowColsClasses(this.row_cols);
  }

}
