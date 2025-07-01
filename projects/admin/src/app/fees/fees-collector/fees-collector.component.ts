import { Component } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TournamentService } from '../../../../../common/services/tournament.service';
import { club_tournament } from '../../../../../common/ffb/interface/club_tournament.interface';
import { FeesCollectorService } from './fees-collector.service';
import { Observable } from 'rxjs';
import { Game, Gamer } from '../fees.interface';
import { PdfService } from '../../../../../common/services/pdf.service';
import { TodaysBooksComponent } from "../../shop/todays-books/todays-books.component";
import { PDF_table } from '../../../../../common/pdf-table.interface';

@Component({
  selector: 'app-fees-collector',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TodaysBooksComponent],
  templateUrl: './fees-collector.component.html',
  styleUrl: './fees-collector.component.scss'
})
export class FeesCollectorComponent {

  back_days: number = 0;
  next_tournaments$: Observable<club_tournament[]>;
  selected_tournament: club_tournament | null = null;
  game!: Game;
  already_charged: boolean = false;
  pdfLoading = false;

  sales_of_the_day_table: PDF_table = {
    headers: [],
    rows: []
  };

  constructor(
    private tournamentService: TournamentService,
    private feesCollectorService: FeesCollectorService,
    private pdfService: PdfService,


  ) {
    this.next_tournaments$ = this.tournamentService.list_next_tournaments(this.back_days);

    this.feesCollectorService.game$.subscribe((game) => {
      this.game = game;
      this.already_charged = this.feesCollectorService.already_charged();
      this.selected_tournament = game.tournament;
    });
  }

  one_week_back() {
    this.back_days += 7;
    this.next_tournaments$ = this.tournamentService.list_next_tournaments(this.back_days);
  }

  euros_collected(): number {
    return this.feesCollectorService.euros_collected();
  }
  stamps_collected(): number {
    return this.feesCollectorService.stamps_collected();
  }


  get_table(table: PDF_table){
    console.log(`Generating today's books PDF`, table);
  }

  tournament_selected(tournament: any) {
    this.selected_tournament = tournament;
    this.feesCollectorService.set_tournament(tournament);
  };

  clear_session() {
    this.selected_tournament = null;
    this.feesCollectorService.init_tournament();
  }

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
    return !gamer.is_member || gamer.in_euro || (gamer.game_credits >= (this.game.fees_doubled ? 2 : 1));
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

  get totalPayants(): number {
    return this.game && this.game.gamers ? this.game.gamers.filter(g => g.enabled).length : 0;
  }

  print_table_to_pdf() {
    if (!this.game || !this.game.gamers) return;
    const headers = ['Nom', 'Prénom', 'Payant', 'Validation'];
    const rows = this.game.gamers.map(gamer => [
      gamer.lastname,
      gamer.firstname,
      gamer.enabled ? 'Oui' : 'Non',
      gamer.validated ? 'Oui' : 'Non'
    ]);
    let fname = this.selected_tournament
      ? `${this.selected_tournament.date}_${this.selected_tournament.tournament_name}.pdf`
      : 'feuille_presence.pdf';

      let table: PDF_table = {
        headers: headers,
        rows: rows
      };
    this.pdfService.generateTablePDF([this.sales_of_the_day_table], fname);
  }


  generate_fees_table(): PDF_table | null {
    if (!this.game || !this.game.gamers) return null;
    const headers = ['Nom', 'Prénom', 'Payant', 'Validation'];
    const rows = this.game.gamers.map(gamer => [
      gamer.lastname,
      gamer.firstname,
      gamer.enabled ? 'Oui' : 'Non',
      gamer.validated ? 'Oui' : 'Non'
    ]);
    return {
      headers: headers,
      rows: rows
    };
  }

}