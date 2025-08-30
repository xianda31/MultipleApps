import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { TournamentService } from '../../../common/services/tournament.service';
import { club_tournament } from '../../../common/ffb/interface/club_tournament.interface';
import { FeesCollectorService } from './fees-collector.service';
import { Observable } from 'rxjs';
import { Game, Gamer } from '../fees.interface';
import { PdfService } from '../../../common/services/pdf.service';
import { TodaysBooksComponent } from "../../shop/todays-books/todays-books.component";
import { HorizontalAlignment, PDF_table } from '../../../common/interfaces/pdf-table.interface';
import { FFBplayer } from '../../../common/ffb/interface/FFBplayer.interface';
import { InputPlayerComponent } from '../../../common/ffb/input-licensee/input-player.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetConfirmationComponent } from '../../modals/get-confirmation/get-confirmation.component';
import { ToastService } from '../../../common/services/toast.service';
import { DBhandler } from "../../../common/services/graphQL.service";
import { SystemDataService } from '../../../common/services/system-data.service';


@Component({
  selector: 'app-fees-collector',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TodaysBooksComponent, InputPlayerComponent],
  templateUrl: './fees-collector.component.html',
  styleUrl: './fees-collector.component.scss'
})
export class FeesCollectorComponent {

  selected_tournament: club_tournament | null = null;

  days_back: number = 0;
  next_tournaments$: Observable<club_tournament[]>;
  game!: Game;
  already_charged: boolean = false;
  pdfLoading = false;
  new_player!: FFBplayer | null;


  sales_of_the_day_table: PDF_table = {
    title: '',
    headers: [],
    alignments: [],
    rows: []
  };

  constructor(
    private tournamentService: TournamentService,
    private feesCollectorService: FeesCollectorService,
    private pdfService: PdfService,
    private modalService: NgbModal,
    private toastService: ToastService,

  ) {
    this.next_tournaments$ = this.tournamentService.list_next_tournaments(this.days_back);
  }

  ngOnInit() {
    this.selected_tournament = this.feesCollectorService.get_tournament();  // persisté par le service

    this.feesCollectorService.game$.subscribe((game) => {
      if (this.selected_tournament) {   // selected_tournament triggers new game$
        this.game = game;
        this.already_charged = this.feesCollectorService.already_charged();
        if (this.already_charged && game.tournament) this.toastService.showInfo(game.tournament.name, 'les droits pour ce tournoi ont été enregistrés !');
      }
      // else {
      //   console.log('No tournament selected, game update ignored.', game);  // TODO : avoid these dummy updates
      // }
    });
  }

  async tournament_selected(tournament: club_tournament | null) {
    if (!tournament) { return; }
    this.feesCollectorService.set_tournament(tournament);
  };

  one_week_back() {
    this.days_back += 7;
    this.next_tournaments$ = this.tournamentService.list_next_tournaments(this.days_back);
  }

  euros_collected(): number {
    return this.feesCollectorService.euros_collected();
  }
  stamps_collected(): number {
    return this.feesCollectorService.stamps_collected();
  }


  get_sales_table(table: PDF_table) {
    this.sales_of_the_day_table = table;
  }


  clear_added_player() {
    this.new_player = null; // or this.new_player = undefined;
  }

  check_status() {

    this.log_game_state();

    if (this.all_gamers_validated()) {
      const modalRef = this.modalService.open(GetConfirmationComponent, { centered: true });
      modalRef.componentInstance.title = `Vous avez pointé tous les joueurs `;
      modalRef.componentInstance.subtitle = `Vous allez maintenant valider tampons et droits de table`;
      modalRef.result.then((answer: boolean) => {
        if (answer) {
          this.validate_fees();
        }
      });
    }

  }

  clear_session() {
    this.game.tournament = null;
    this.selected_tournament = null!;
    this.feesCollectorService.clear_tournament();
  }

  toggle_sort() {
    this.feesCollectorService.toggle_sort();
  }

  toggle_fee() {
    this.feesCollectorService.toggle_fee();
  }

  async validate_fees() {
    this.tables_to_pdf();
    await this.feesCollectorService.save_fees()
    this.clear_session();
  }

  add_player(player: FFBplayer | null) {
    if (player) {
      this.feesCollectorService.add_player(player);
      this.log_game_state();
    }
  }

  all_gamers_validated(): boolean {
    return !!this.game.tournament && !!this.game && this.game.gamers.every(gamer => (gamer.validated || !gamer.enabled));
  }

  gamer_solvent(gamer: Gamer): boolean {
    return !gamer.is_member || gamer.in_euro || (gamer.game_credits >= (this.game.fees_doubled ? 2 : 1));
  }

  gamer_class(gamer: Gamer): string {
    let card_class = 'card h-100';
    if (!gamer.enabled) {
      card_class += 'bg-success shadow-lg text-bg-success NP';
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

  async log_game_state() {
    return this.feesCollectorService.log_game_state();
  }

  tables_to_pdf() {

    const gamers_table = this.build_gamers_table();

    let fname = this.game.tournament
      ? `${this.game.tournament.date}_${this.game.tournament.name}.pdf`
      : 'feuille_presence.pdf';


    this.pdfService.generateTablePDF([gamers_table, this.sales_of_the_day_table], fname);

  }

  build_gamers_table(): PDF_table {

    let payment = (gamer: Gamer) => {
      if (!gamer.validated) return 'dispense';
      if (gamer.enabled) {
        return gamer.in_euro ? (gamer.price.toFixed(2) + ' €') : ((this.game.fees_doubled ? 2 : 1) + 'tampon(s)');
      } else {
        return 'Carte';
      }
    }

    if (!this.game || !this.game.gamers) return { title: '', headers: [], alignments: [], rows: [] };
    const title = 'recettes : ' + this.stamps_collected() + ' tampon(s) et ' + this.euros_collected() + ' €';
    const headers = ['Joueur1', 'Paiement1', 'Joueur2', 'Paiement2'];
    const alignments: HorizontalAlignment[] = ['left', 'right', 'left', 'right'];
    const rows: any[] = [];
    for (let i = 0; i < this.game.gamers.length; i += 2) {
      const gamer1 = this.game.gamers[i];
      const gamer2 = this.game.gamers[i + 1];
      rows.push([
        gamer1 ? gamer1.lastname + ' ' + gamer1.firstname : '',
        gamer1 ? payment(gamer1) : '',
        gamer2 ? gamer2.lastname + ' ' + gamer2.firstname : '',
        gamer2 ? payment(gamer2) : ''
      ]);
    }
    return { title, headers, alignments, rows };
  }


}