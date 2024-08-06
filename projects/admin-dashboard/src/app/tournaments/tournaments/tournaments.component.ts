import { Component } from '@angular/core';
import { FfbService } from '../../ffb/services/ffb.service';
import { ffb_tournament } from '../../ffb/interface/tournament.ffb.interface';
import { CommonModule } from '@angular/common';
import { TournamentComponent } from '../tournament/tournament.component';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [CommonModule,
    TournamentComponent
  ],
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
