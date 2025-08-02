import { CommonModule, formatDate } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { club_tournament } from '../../ffb/interface/club_tournament.interface';
import { TournamentService } from '../../services/tournament.service';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './tournaments.component.html',
  styleUrls: ['./tournaments.component.scss']
})
export class TournamentsComponent implements OnInit, OnChanges {
  @Input() refresh: number = 0; // Used to force refresh of tournaments

  all_tournaments: club_tournament[] = [];
  next_tournaments: club_tournament[] = [];
  tournaments: club_tournament[] = [];
  tournaments_subscription?: Subscription;

  tournamentSelected = false;
  selectedTournament?: club_tournament;
  enrolled = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tournamentService: TournamentService
  ) { }

  ngOnInit(): void {
    this.loadTournaments();
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refresh']) {
      this.loadTournaments();
    }
  }
  
  loadTournaments() {
    this.tournamentService.listTournaments().subscribe((all_tournaments: club_tournament[]) => {
      console.log('TournamentsComponent: Refreshing tournaments');
      this.all_tournaments = all_tournaments;
      this.tournaments = this.filter_next_tournaments();
    });
  }

  // ngOnDestroy(): void {
  //   this.tournaments_subscription?.unsubscribe();
  // }

  filter_next_tournaments(): club_tournament[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.all_tournaments
      .filter((t) => new Date(t.date) >= today)
      .map((tournament: club_tournament) => {
        return {
          ...tournament,
          date: formatDate(tournament.date, 'EEEE d MMMM', 'fr-FR'),
          time: tournament.time.split(':').slice(0, 2).join(':')
        };
      });
  }

  tournamentClass(name: string): { card: string, icon: string } {
    const _class = "card h-100 ";
    // Normalisation pour enlever les accents
    const _name = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
    if (_name.includes('roy')) return { card: _class + 'border-primary', icon: 'bi bi-award' };
    // Détection de 'eleves' ou 'élèves' (avec ou sans accent)
    if ( _name.includes('eleve')) return { card: _class + 'border-success', icon: 'bi bi-mortarboard-fill' };
    return { card: _class, icon: '' };
  }

  goToTournament(tournament: club_tournament) {
    if (this.tournamentSelected) {
      this.closeTournament();
    } else {
      // Navigation relative to current route (if needed, adjust as per router config)
      this.router.navigate([
        'tournaments',
        tournament.id
      ], {
        relativeTo: this.route,
        queryParams: {
          team_tournament_id: tournament.team_tournament_id,
          tournament_date: tournament.date,
          tournament_name: tournament.tournament_name,
        }
      });
    }
  }

  selectTournament(tournament: club_tournament) {
    this.tournaments = [tournament];
    this.tournamentSelected = true;
    this.selectedTournament = tournament;
  }

  closeTournament() {
    this.tournamentSelected = false;
    this.tournaments = [...this.next_tournaments];
    this.selectedTournament = undefined;
  }

  done() {
    this.tournamentSelected = false;
    this.selectedTournament = undefined;
  }
}
