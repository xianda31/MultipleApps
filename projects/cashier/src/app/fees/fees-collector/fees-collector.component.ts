import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TournamentService } from '../../../../../common/services/tournament.service';
import { club_tournament } from '../../../../../common/ffb/interface/club_tournament.interface';
import { FeesCollectorService } from './fees-collector.service';
import { Observable } from 'rxjs';
import { Game, Gamer } from '../fees.interface';
import { PdfService } from '../../../../../common/services/pdf.service';
import { BackComponent } from '../../../../../common/back/back.component';



@Component({
  selector: 'app-fees-collector',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, BackComponent],
  templateUrl: './fees-collector.component.html',
  styleUrl: './fees-collector.component.scss'
})
export class FeesCollectorComponent {

  back_days: number = 0;
  next_tournaments$: Observable<club_tournament[]>;
  selected_tournament: club_tournament | null = null;
  game!: Game;

  constructor(
    private tournamentService: TournamentService,
    private feesCollectorService: FeesCollectorService,
    private pdfService: PdfService


  ) {
    this.next_tournaments$ = this.tournamentService.list_next_tournaments(this.back_days);
    
    this.feesCollectorService.game$.subscribe((game) => {
      this.game = game;   
      // console.log('game$ subscription',this.game?.tournament)
      this.selected_tournament = game.tournament;
      // console.log('selected tournament:', this.selected_tournament?.date);
    });
  }

  one_week_back() {
    this.back_days += 7;
    this.next_tournaments$ = this.tournamentService.list_next_tournaments(this.back_days);
  }

  print_to_pdf() {
    let fname = this.selected_tournament!.date + '_' + this.selected_tournament!.tournament_name + '.pdf';
    this.pdfService.generatePDF("print_zone", fname);
  }

  tournament_selected(tournament: any) {
    this.selected_tournament = tournament;
    this.feesCollectorService.set_tournament(tournament);
  };


  toggle_sort() {
    this.feesCollectorService.toggle_sort();
  }

  toggle_fee() {
    this.feesCollectorService.toggle_fee();
  }

  validate_fees() {
    this.feesCollectorService.save_fees();
    this.selected_tournament = null;
    this.game.tournament = null;
  }

  all_gamers_validated(): boolean {
    return this.game && this.game.gamers.every(gamer => (gamer.validated || !gamer.enabled));
  }

  gamer_solvent(gamer: Gamer): boolean {
    return !gamer.is_member || gamer.in_euro || (gamer.game_credits >= gamer.price);
  }

  gamer_class(gamer: Gamer): string {
    let card_class = 'card h-100';
    if (!gamer.enabled) {
      card_class += ' bg-light text-secondary border-secondary';
      return card_class;
    }

    if (gamer.validated) {
      card_class += ' bg-success shadow-lg text-bg-success';
    } else {
      if (gamer.is_member)
        card_class += ' border-primary';
      else {
        card_class += ' border-secondary';
      }
    }
    return card_class
  }
}