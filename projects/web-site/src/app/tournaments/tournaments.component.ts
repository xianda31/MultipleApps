import { CommonModule, formatDate } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FFB_tournament } from '../../../../common/ffb/interface/FFBtournament.interface';
import { FfbService } from '../../../../common/ffb/services/ffb.service';
import { TeamsComponent } from './teams/teams.component';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [RouterModule, CommonModule, TeamsComponent],
  templateUrl: './tournaments.component.html',
  styleUrl: './tournaments.component.scss'
})
export class TournamentsComponent {
  nextTournaments!: FFB_tournament[];
  tournaments: FFB_tournament[] = [];

  tournamentSelected = false;
  selectedTournament!: FFB_tournament;
  constructor(
    private ffbService: FfbService
  ) { }
  async ngOnInit(): Promise<void> {
    const today = new Date();
    this.nextTournaments = await this.ffbService.getTournaments();
    this.nextTournaments = this.nextTournaments.filter((tournament: FFB_tournament) => {
      return new Date(tournament.date) >= today;
    });
    this.nextTournaments.forEach((tournament: FFB_tournament) => {
      tournament.date = formatDate(tournament.date, 'dd-MM-yyyy', 'en-FR');
      tournament.time = tournament.time.split(':').slice(0, 2).join(':');
    }
    );
    this.tournaments = this.nextTournaments;
    console.log('TournamentsComponent.ngOnInit', this.tournaments);
  }


  clickOnTournament(tournament: FFB_tournament) {
    if (this.tournamentSelected) {
      this.closeTournament();
    } else {
      this.selectTournament(tournament);
    }
  }
  selectTournament(tournament: FFB_tournament) {
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
