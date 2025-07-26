import { CommonModule, DatePipe, formatDate } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { club_tournament } from '../../ffb/interface/club_tournament.interface';
import { FFB_proxyService } from '../../ffb/services/ffb.service';
import { TeamsComponent } from '../teams/teams.component';
import { environment } from '../../../admin/src/environments/environment.development';
import { ToastService } from '../../toaster/toast.service';
import { TournamentService } from '../../services/tournament.service';
import { data } from '../../../../amplify/data/resource';
import { ReplacePipe } from "../../pipes/replace.pipe";

@Component({
    selector: 'app-tournaments',
    imports: [RouterModule, CommonModule, TeamsComponent],
    templateUrl: './tournaments.component.html',
    styleUrl: './tournaments.component.scss'
})
export class TournamentsComponent implements OnInit, OnDestroy {

  app: string = environment.app;

  // nextTournaments!: club_tournament[];
  all_tournaments!: club_tournament[];
  next_tournaments!: club_tournament[];
  tournaments!: club_tournament[];
  tournaments_subscription: any;

  tournamentSelected = false;
  selectedTournament!: club_tournament;
  enrolled = false;



  constructor(
    private activeRouter: ActivatedRoute,
    private router: Router,
    private tournamentService: TournamentService


  ) { }


  ngOnDestroy(): void {
    this.tournaments_subscription.unsubscribe();
  }


  ngOnInit(): void {
    this.activeRouter.data.subscribe(async data => {
      // console.log('ngOnInit', data);
      let { app } = data;
      this.app = app;
    });

    this.tournaments_subscription = this.tournamentService.listTournaments().subscribe((all_tournaments: club_tournament[]) => {
      this.all_tournaments = all_tournaments;
      this.next_tournaments = this.filter_next_tournaments();
      this.tournaments = this.next_tournaments;
    });

  }

  filter_next_tournaments(): club_tournament[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.all_tournaments
      .filter((t) => new Date(t.date) >= today)
      .map((tournament: club_tournament) => {
        tournament.date = formatDate(tournament.date, 'EEEE d MMMM', 'fr-FR');
        tournament.time = tournament.time.split(':').slice(0, 2).join(':');
        return tournament;
      });
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
      // this.selectTournament(tournament);
      this.router.navigate([
        'tournaments',
        tournament.id],
        {
          queryParams: {
            team_tournament_id: tournament.team_tournament_id,
            tournament_name: tournament.tournament_name,
          }
        }
      );
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
    this.tournaments = this.next_tournaments;

  }

  done() {
    this.tournamentSelected = false;
  }



}
