import { Component } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { TournamentComponent } from '../tournament/tournament.component';
import { club_tournament } from '../../../../../common/ffb/interface/club_tournament.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';
import { TeamsComponent } from '../teams/teams.component';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [CommonModule, TournamentComponent, TeamsComponent],
  templateUrl: './tournaments.component.html',
  styleUrl: './tournaments.component.scss'
})
export class TournamentsComponent {
  nextTournaments!: club_tournament[];
  tournaments: club_tournament[] = [];

  tournamentSelected = false;
  selectedTournament!: club_tournament;
  // Math: any;
  constructor(
    private ffbService: FfbService
  ) { }
  async ngOnInit(): Promise<void> {
    const today = new Date();
    this.nextTournaments = await this.ffbService.getTournaments();
    this.nextTournaments = this.nextTournaments.filter((tournament: club_tournament) => {
      return new Date(tournament.date) >= today;
    });
    this.nextTournaments.forEach((tournament: club_tournament) => {
      tournament.date = formatDate(tournament.date, 'dd-MM-yyyy', 'en-FR');
      tournament.time = tournament.time.split(':').slice(0, 2).join(':');
    }
    );
    this.tournaments = this.nextTournaments;
  }

  done(subscribed: boolean) {
    this.tournamentSelected = false;
  }

  clickOnTournament(tournament: club_tournament) {
    if (this.tournamentSelected) {
      this.closeTournament();
    } else {
      this.selectTournament(tournament);
    }
  }
  selectTournament(tournament: club_tournament) {
    this.tournaments = [];
    this.tournaments.push(tournament);
    this.tournamentSelected = true;
    this.selectedTournament = tournament;
  }

  closeTournament() {
    this.tournamentSelected = false;
    this.tournaments = this.nextTournaments;


  }

}
