import { CommonModule, DatePipe, formatDate } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { club_tournament } from '../../../../common/ffb/interface/club_tournament.interface';
import { FfbService } from '../../../../common/ffb/services/ffb.service';
import { TeamsComponent } from './teams/teams.component';
import { environment } from '../../environments/environment.development';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [RouterModule, CommonModule, TeamsComponent, DatePipe],
  templateUrl: './tournaments.component.html',
  styleUrl: './tournaments.component.scss'
})
export class TournamentsComponent {

  app: string = environment.app;

  nextTournaments!: club_tournament[];
  tournaments: club_tournament[] = [];

  tournamentSelected = false;
  selectedTournament!: club_tournament;
  enrolled = false;



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
      tournament.date = formatDate(tournament.date, 'EEEE d MMMM', 'fr-FR');
      tournament.time = tournament.time.split(':').slice(0, 2).join(':');
    }
    );
    this.tournaments = this.nextTournaments;
  }

  tournamentClass(name: string): { card: string, icon: string } {
    const _class = "card h-100";
    const _name = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
    if (_name.includes('roy')) return { card: _class + 'border-primary', icon: 'fas fa-crown' };
    if (_name.includes('eleves')) return { card: _class + 'border-success', icon: 'fas fa-graduation-cap' };
    return { card: _class, icon: '' };
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
