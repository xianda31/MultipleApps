import { CommonModule, formatDate } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ffb_tournament } from '../../../../admin-dashboard/src/app/ffb/interface/tournament.ffb.interface';
import { FfbService } from '../../../../admin-dashboard/src/app/ffb/services/ffb.service';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './tournaments.component.html',
  styleUrl: './tournaments.component.scss'
})
export class TournamentsComponent {
  nextTournaments!: ffb_tournament[];
  tournaments: ffb_tournament[] = [];

  tournamentSelected = false;
  selectedTournament!: ffb_tournament;
  constructor(
    private ffbService: FfbService
  ) { }
  async ngOnInit(): Promise<void> {
    const today = new Date();
    this.nextTournaments = await this.ffbService.getTournaments();
    this.nextTournaments = this.nextTournaments.filter((tournament: ffb_tournament) => {
      return new Date(tournament.date) >= today;
    });
    this.nextTournaments.forEach((tournament: ffb_tournament) => {
      tournament.date = formatDate(tournament.date, 'dd-MM-yyyy', 'en-FR');
      tournament.time = tournament.time.split(':').slice(0, 2).join(':');
    }
    );
    this.tournaments = this.nextTournaments;
    console.log('TournamentsComponent.ngOnInit', this.tournaments);
  }

  selectTournament(tournament: ffb_tournament) {
    this.tournaments = [];
    this.tournaments.push(tournament);
    this.tournamentSelected = true;
    this.selectedTournament = tournament;
  }

  saveTournament() {
    this.tournamentSelected = false;
    this.tournaments = this.nextTournaments;


  }
}
