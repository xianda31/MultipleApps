import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { BookService } from '../services/book.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { Revenue, Expense, BookEntry, CUSTOMER_ACCOUNT } from '../../common/interfaces/accounting.interface';
import { TournamentService } from '../../common/services/tournament.service';
import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent {

  revenues!: Revenue[];
  expenses: Expense[] = [];
  book_entries: BookEntry[] = [];
  allMonths: string[] = [];
  startYear!: number;

  // playerCountsByMonth: { [month: string]: number } = {};
  // chartPlayerCounts: (number | null)[] = [];
  // playerCountAverage: number = 0;
  // tournamentCountByMonth: { [month: string]: number } = {};
  // chartTournamentCounts: (number | null)[] = [];
  // tournamentCountAverage: number = 0;
  financialChartData: any = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Revenus',
        backgroundColor: '',
        borderColor: '',
        borderWidth: 2,
        borderRadius: 4
      },
      {
        data: [],
        label: 'Dépenses',
        backgroundColor: '',
        borderColor: '',
        borderWidth: 2,
        borderRadius: 4
      },
      {
        type: 'line',
        data: [],
        label: 'Solde cumulé',
        borderColor: '',
        backgroundColor: '',
        pointBackgroundColor: '',
        pointRadius: 5,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        fill: true,
        tension: 0.3
      }
    ]
  };
  playerChartData: any = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Joueurs',
        backgroundColor: '',
        borderColor: '',
        borderWidth: 2,
        borderRadius: 4,
        yAxisID: 'y'
      },
      {
        type: 'line',
        data: [],
        label: 'Tournois',
        borderColor: '',
        backgroundColor: '',
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        yAxisID: 'y1'
      }
    ]
  };
  playerChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false // Désactiver la légende native de Chart.js, on utilise une légende personnalisée en HTML
      },
      title: {
        display: false,
        text: 'Joueurs et tournois par mois'
      }
    },
    scales: {
      x: {
        stacked: false,
        ticks: { font: { size: 11 } }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        stacked: false,
        beginAtZero: true,
        grid: { display: true },
        ticks: { font: { size: 11 } },
        title: { display: true, text: 'Joueurs' }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        ticks: { font: { size: 11 } },
        title: { display: true, text: 'Tournois' }
      }
    }
  };
  financialChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false // Désactiver la légende native de Chart.js, on utilise une légende personnalisée en HTML
      },
      title: {
        display: false,
        text: 'Recettes, dépenses et résultat par mois'
      }
    },
    scales: {
      x: {
        stacked: false,
        ticks: { font: { size: 11 } }
      },
      y: {
        stacked: false,
        beginAtZero: true,
        grid: { display: true },
        ticks: { font: { size: 11 } }
      }
    }
  };

  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private tournamentService: TournamentService
  ) { }
  ngOnInit() {

    // Récupérer dynamiquement les couleurs CSS custom properties
    const root = getComputedStyle(document.documentElement);
    const primary = root.getPropertyValue('--color-primary').trim();
    const secondary = root.getPropertyValue('--color-secondary').trim();
    const info = root.getPropertyValue('--color-info').trim();

    // Générer tous les mois de la saison courante (juillet à juin)
    const season = this.systemDataService.get_season(new Date());
    this.startYear = parseInt(season.slice(0, 4));
    this.allMonths = this.generateSeasonMonths(this.startYear);

    // Initialiser les données financières et de tournois, puis configurer les datasets des graphiques avec les couleurs récupérées

    this.initialize_financial_data(this.allMonths).subscribe(({ chartRevenue, chartExpense, chartResult }) => {

      this.financialChartData = {
        ...this.financialChartData,
        labels: this.allMonths,
        datasets: [
          {
            ...this.financialChartData.datasets[0],
            data: chartRevenue,
            backgroundColor: primary + '99', // 60% opacity
            borderColor: primary
          },
          {
            ...this.financialChartData.datasets[1],
            data: chartExpense,
            backgroundColor: secondary + '99', // 60% opacity
            borderColor: secondary
          },
          {
            ...this.financialChartData.datasets[2],
            type: 'line',
            data: chartResult,
            borderColor: info,
            backgroundColor: info + '1A', // ~10% opacity
            pointBackgroundColor: info,
            pointRadius: 5,
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }
        ]
      };
    });

    // initialiser les données de tournois et joueurs, puis configurer les datasets du graphique avec les couleurs récupérées
    this.initialize_tournaments_data(this.allMonths).subscribe(({ playerCounts, tournamentCounts }) => {

      // Calculer les moyennes
      const nonNullPlayerCounts = playerCounts.filter(c => c !== null) as number[];
      const nonNullTournamentCounts = tournamentCounts.filter(c => c !== null) as number[];
      const playerCountAverage = nonNullPlayerCounts.length > 0 ? nonNullPlayerCounts.reduce((a, b) => a + b, 0) / nonNullPlayerCounts.length : 0;
      const tournamentCountAverage = nonNullTournamentCounts.length > 0 ? nonNullTournamentCounts.reduce((a, b) => a + b, 0) / nonNullTournamentCounts.length : 0;

      // Initialisation du barChart joueurs avec les deux datasets
      this.playerChartData = {
        labels: this.allMonths,
        datasets: [
          {
            data: playerCounts,
            label: 'Joueurs',
            backgroundColor: primary + '99',
            borderColor: primary,
            borderWidth: 2,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            type: 'line',
            data: tournamentCounts,
            label: 'Tournois',
            borderColor: info,
            backgroundColor: info + '1A',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: 5,
            pointBackgroundColor: info,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y1'
          },
          {
            type: 'line',
            data: this.allMonths.map(() => playerCountAverage),
            label: 'Moy. Joueurs',
              borderColor: primary,
              backgroundColor: 'transparent',
              borderWidth: 2, 
              borderDash: [5, 5],
              tension: 0,
              pointRadius: 0,
              yAxisID: 'y'
          },
          {
            type: 'line',
            data: this.allMonths.map(() => tournamentCountAverage),
            label: 'Moy. Tournois',
              borderColor: info,
              backgroundColor: 'transparent',
              borderWidth: 2, 
              borderDash: [5, 5],
              tension: 0,
              pointRadius: 0,
              yAxisID: 'y1'
          }
        ]
      };
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

        this.book_entries = book_entries;
        this.revenues = this.bookService.get_revenues();
        this.expenses = this.bookService.get_expenses();

        const month_data = this.calculate_monthly_data();

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

  calculate_monthly_data(): { [key: string]: { revenue: number, expense: number } } {
    // this.month_data = {};
    const monthTotals: { [key: string]: { revenue: number, expense: number } } = {};

    // Helper pour filtrer CUSTOMER_ACCOUNT
    const filterValues = (values: { [key: string]: number }) => {
      return Object.entries(values)
        .filter(([key]) => !Object.values(CUSTOMER_ACCOUNT).includes(key as CUSTOMER_ACCOUNT))
        .reduce((acc, [, value]) => acc + value, 0);
    };

    // Revenus par mois
    for (const rev of this.revenues) {
      const month = rev.date.slice(0, 7);
      if (!monthTotals[month]) monthTotals[month] = { revenue: 0, expense: 0 };
      monthTotals[month].revenue += filterValues(rev.values);
    }

    // Dépenses par mois
    for (const exp of this.expenses) {
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

