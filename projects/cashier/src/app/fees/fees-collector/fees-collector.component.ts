import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TournamentService } from '../../../../../common/services/tournament.service';
import { club_tournament } from '../../../../../common/ffb/interface/club_tournament.interface';
import { FeesCollectorService } from './fees-collector.service';
import { Observable } from 'rxjs';
import { Game } from '../fees.interface';
import { FeesEditorService } from '../fees-editor/fees-editor.service';




@Component({
  selector: 'app-fees-collector',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './fees-collector.component.html',
  styleUrl: './fees-collector.component.scss'
})
export class FeesCollectorComponent {

  next_tournaments: Observable<club_tournament[]>;
  selected_tournament: club_tournament | null = null;
  // fee_factor: number = 1;
  // game$!: Observable<Game>
  game!: Game;

  constructor(
    private tournamentService: TournamentService,
    private feesCollectorService: FeesCollectorService,
    private feesEditorService: FeesEditorService


  ) {
    this.next_tournaments = this.tournamentService.list_next_tournaments();
    this.feesCollectorService.game$.subscribe((game) => {
      this.game = game;
      console.log('game', game);
    });
  }

  tournament_selected(tournament: any) {
    this.selected_tournament = tournament;
    console.log('tournament', tournament);
    this.feesCollectorService.set_tournament(tournament);
  };


  check_all_members() {
    this.feesCollectorService.check_all_members();
  }

  toggle_sort() {
    this.feesCollectorService.toggle_sort();
  }

  toggle_fee() {
    this.feesCollectorService.toggle_fee();
  }


  save_fees() {
    this.feesCollectorService.save_fees();
  }

  get_current_game_credit(member_id: string): number {
    return this.feesEditorService.get_current_game_credit(member_id);
  }

}