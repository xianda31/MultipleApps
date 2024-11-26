import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TournamentService } from '../../../../../common/services/tournament.service';
import { club_tournament } from '../../../../../common/ffb/interface/club_tournament.interface';
import { FeesService } from '../fees.service';
import { Observable } from 'rxjs';
import { Game } from './fees.interface';




@Component({
  selector: 'app-fees',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './fees.component.html',
  styleUrl: './fees.component.scss'
})
export class FeesComponent {

  next_tournaments: Observable<club_tournament[]>;
  selected_tournament: club_tournament | null = null;
  // fee_factor: number = 1;
  game$!: Observable<Game>

  constructor(
    private tournamentService: TournamentService,
    private feesService: FeesService,


  ) {
    this.next_tournaments = this.tournamentService.list_next_tournaments();

    this.game$ = this.feesService.game$;


  }

  tournament_selected(tournament: club_tournament) {
    this.feesService.set_tournament(tournament);
  };

  check_all_members() {
    this.feesService.check_all_members();
  }

  toggle_sort() {
    this.feesService.toggle_sort();
  }

  toggle_fee() {
    this.feesService.toggle_fee();
  }


  save_fees() {
    this.feesService.save_fees();
  }
}