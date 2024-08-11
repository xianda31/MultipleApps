import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TournamentComponent } from '../tournament/tournament.component';
import { TeamsComponent } from "../../../../../web-site/src/app/tournaments/teams/teams.component";
import { FFB_tournament } from '../../../../../common/ffb/interface/FFBtournament.interface';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [CommonModule,
    TournamentComponent, TeamsComponent],
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
    this.tournaments = this.nextTournaments;
    console.log('TournamentsComponent.ngOnInit', this.tournaments);
  }

  selectTournament(tournament: FFB_tournament) {
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
