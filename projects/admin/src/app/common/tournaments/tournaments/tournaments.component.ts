import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { TournamentTeams } from '../../ffb/interface/tournament_teams.interface';

@Component({
  selector: 'app-tournaments',
  imports: [RouterModule, CommonModule],
  templateUrl: './tournaments.component.html',
  styleUrls: ['./tournaments.component.scss']
})
export class TournamentsComponent implements OnInit, OnChanges {
  @Input() refresh: number = 0; // Used to force refresh of tournaments
  @Output() loaded = new EventEmitter<boolean>();

  next_tournament_teams: TournamentTeams[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private tournamentService: TournamentService
  ) { }

  ngOnInit(): void {
    this.loadTournamentTeams();
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['refresh']) {
      this.loadTournamentTeams();
    }
  }

  loadTournamentTeams() {
    this.tournamentService.list_next_tournament_teams(0).subscribe((next_tournament_teams: TournamentTeams[]) => {
      this.next_tournament_teams = next_tournament_teams;
      this.loaded.emit(true); // Emit loaded event when tournaments are loaded
    });
  }

  tournamentClass(name: string): { card: string, icon: string } {
    const _class = "card h-100 ";
    // Normalisation pour enlever les accents
    const _name = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
    if (_name.includes('roy')) return { card: _class + 'border-primary', icon: 'bi bi-award' };
    if (_name.includes('eleve')) return { card: _class + 'border-success', icon: 'bi bi-mortarboard-fill' };
    return { card: _class, icon: '' };
  }

  goToTournamentTeams(tournamentTeams: TournamentTeams) {
    this.router.navigate(['tournaments', tournamentTeams.subscription_tournament.id],
      { relativeTo: this.route });
  }
}
