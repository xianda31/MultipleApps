import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { BookService } from '../services/book.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { Revenue, Expense, BookEntry, CUSTOMER_ACCOUNT } from '../../common/interfaces/accounting.interface';
import { TournamentService } from '../../common/services/tournament.service';
import { Observable, map } from 'rxjs';
  import { DashboardGraphService } from './dashboard.graph.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent {

  allMonths: string[] = [];
  startYear!: number;

  
  financialChartData: any;
  playerChartData: any;
  playerChartOptions!: ChartOptions<any>;
  financialChartOptions!: ChartOptions<any>;

  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private tournamentService: TournamentService,
    private graphService: DashboardGraphService
  ) {
  }


  ngOnInit() {


    // Générer tous les mois de la saison courante (juillet à juin)
    const season = this.systemDataService.get_season(new Date());
    this.startYear = parseInt(season.slice(0, 4));
    this.allMonths = this.generateSeasonMonths(this.startYear);

    // Initialiser les données financières et de tournois, puis configurer les datasets des graphiques avec les couleurs récupérées

    this.initialize_financial_data(this.allMonths).subscribe(({ chartRevenue, chartExpense, chartResult }) => {

      ({data: this.financialChartData, options: this.financialChartOptions} = this.graphService.buildFinancialChart(
        this.allMonths,
        chartRevenue,
        chartExpense,
        chartResult
      ));
    });

    // initialiser les données de tournois et joueurs, puis configurer les datasets du graphique avec les couleurs récupérées
    this.initialize_tournaments_data(this.allMonths).subscribe(({ playerCounts, tournamentCounts }) => {

      // Calculer les moyennes
      const nonNullPlayerCounts = playerCounts.filter(c => c !== null) as number[];
      const nonNullTournamentCounts = tournamentCounts.filter(c => c !== null) as number[];
      const playerCountAverage = nonNullPlayerCounts.length > 0 ? nonNullPlayerCounts.reduce((a, b) => a + b, 0) / nonNullPlayerCounts.length : 0;
      const tournamentCountAverage = nonNullTournamentCounts.length > 0 ? nonNullTournamentCounts.reduce((a, b) => a + b, 0) / nonNullTournamentCounts.length : 0;

      ({data: this.playerChartData, options: this.playerChartOptions} = this.graphService.buildPlayerChart(
        this.allMonths,
        playerCounts,
        tournamentCounts,
        playerCountAverage,
        tournamentCountAverage
      ));
    });

  }

  initialize_tournaments_data(chartLabels: string[]): Observable<{ playerCounts: (number | null)[], tournamentCounts: (number | null)[] }> {
    // Initialise les données joueurs et tournois par mois
    const daysBack = Math.ceil((new Date().getTime() - new Date(`${this.startYear}-07-01`).getTime()) / (1000 * 60 * 60 * 24));

    return this.tournamentService.list_next_tournaments(daysBack).pipe(
      map((trns) => {
        let playerCountsByMonth: { [month: string]: number } = {};
        let tournamentCountByMonth: { [month: string]: number } = {};
        trns.forEach(trn => {
          const d = new Date(trn.date);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const key = `${yyyy}-${mm}`;
          const pc = typeof trn.nbr_inscrit === 'number' ? trn.nbr_inscrit : parseInt(trn.nbr_inscrit, 10);
          playerCountsByMonth[key] = (playerCountsByMonth[key] || 0) + (isNaN(pc) ? 0 : pc);
          tournamentCountByMonth[key] = (tournamentCountByMonth[key] || 0) + 1;
        });
        const playerCounts: (number | null)[] = chartLabels.map(m => playerCountsByMonth[m] ?? null);
        const tournamentCounts: (number | null)[] = chartLabels.map(m => tournamentCountByMonth[m] ?? null);


        return { playerCounts, tournamentCounts };
      })
    );
  }

  initialize_financial_data(chartLabels: string[]): Observable<{ chartRevenue: (number | null)[], chartExpense: (number | null)[], chartResult: (number | null)[] }> {

    // initialise les données financières

    return this.bookService.list_book_entries().pipe(
      map((book_entries: BookEntry[]) => {

        // this.book_entries = book_entries;
        const revenues = this.bookService.get_revenues();
        const expenses = this.bookService.get_expenses();

        const month_data = this.calculate_monthly_data(revenues, expenses);

        // Préparer les données pour le graphique avec tous les mois (null pour les mois sans données)
        const chartRevenue = chartLabels.map(m => month_data[m]?.revenue ?? null);
        const chartExpense = chartLabels.map(m => month_data[m]?.expense ?? null);

        // Calculer l'intégrale cumulative du solde (chartResult), skip null values
        let cumsum = 0;
        const chartResult = chartLabels.map(month => {
          const diff = month_data[month] ? (month_data[month].revenue - month_data[month].expense) : null;
          if (diff !== null) {
            cumsum += diff;
            return cumsum;
          } else {
            return null;
          }
        });
        return { chartRevenue, chartExpense, chartResult };
      })
    );
  }

  calculate_monthly_data(revenues: Revenue[], expenses: Expense[]): { [key: string]: { revenue: number, expense: number } } {
    // this.month_data = {};
    const monthTotals: { [key: string]: { revenue: number, expense: number } } = {};

    // Helper pour filtrer CUSTOMER_ACCOUNT
    const filterValues = (values: { [key: string]: number }) => {
      return Object.entries(values)
        .filter(([key]) => !Object.values(CUSTOMER_ACCOUNT).includes(key as CUSTOMER_ACCOUNT))
        .reduce((acc, [, value]) => acc + value, 0);
    };

    // Revenus par mois
    for (const rev of revenues) {
      const month = rev.date.slice(0, 7);
      if (!monthTotals[month]) monthTotals[month] = { revenue: 0, expense: 0 };
      monthTotals[month].revenue += filterValues(rev.values);
    }

    // Dépenses par mois
    for (const exp of expenses) {
      const month = exp.date.slice(0, 7);
      if (!monthTotals[month]) monthTotals[month] = { revenue: 0, expense: 0 };
      monthTotals[month].expense += filterValues(exp.values);
    }

    return monthTotals;
  }

  generateSeasonMonths(startYear: number): string[] {
    const months: string[] = [];
    // De juillet (mois 7) de startYear à juin (mois 6) de startYear+1
    for (let month = 7; month <= 12; month++) {
      months.push(`${startYear}-${String(month).padStart(2, '0')}`);
    }
    for (let month = 1; month <= 6; month++) {
      months.push(`${startYear + 1}-${String(month).padStart(2, '0')}`);
    }
    return months;
  }


}

