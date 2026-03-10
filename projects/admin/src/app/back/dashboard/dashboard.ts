import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { BookService } from '../services/book.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { Revenue, Expense, BookEntry, CUSTOMER_ACCOUNT } from '../../common/interfaces/accounting.interface';

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
  month_data: { [key: string]: { revenue: number, expense: number } } = {};
  chartLabels: string[] = [];
  chartRevenue: (number | null)[] = [];
  chartExpense: (number | null)[] = [];
  chartResult: (number | null)[] = [];

  barChartData: any = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Recettes',
        backgroundColor: '',
        borderColor: '',
        borderWidth: 1.5,
        borderRadius: 4
      },
      {
        data: [],
        label: 'Dépenses',
        backgroundColor: '',
        borderColor: '',
        borderWidth: 1.5,
        borderRadius: 4
      },
      {
        type: 'line',
        data: [],
        label: 'Résultat',
        borderColor: '',
        backgroundColor: '',
        borderWidth: 3,
        tension: 0.4,
        fill: false,
        pointRadius: 5,
        pointBackgroundColor: '',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }
    ]
  };
  barChartOptions: ChartOptions<'bar'> = {
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
    private systemDataService: SystemDataService
  ) { }
  ngOnInit() {

  // Récupérer dynamiquement les couleurs CSS custom properties
  const root = getComputedStyle(document.documentElement);
  const primary = root.getPropertyValue('--color-primary').trim();
  const secondary = root.getPropertyValue('--color-secondary').trim();
  const info = root.getPropertyValue('--color-info').trim();



    this.bookService.list_book_entries().subscribe((book_entries) => {
      this.book_entries = book_entries;
      this.revenues = this.bookService.get_revenues();
      this.expenses = this.bookService.get_expenses();

      this.month_data = this.calculate_monthly_data();

      // console.log('Monthly data for dashboard:', this.month_data);

      // Générer tous les mois de la saison courante (juillet à juin)
      const season = this.systemDataService.get_season(new Date());
      const startYear = parseInt(season.slice(0, 4));
      const allMonths = this.generateSeasonMonths(startYear);

      // Préparer les données pour le graphique avec tous les mois (null pour les mois sans données)
      this.chartLabels = allMonths;
      this.chartRevenue = allMonths.map(m => this.month_data[m]?.revenue ?? null);
      this.chartExpense = allMonths.map(m => this.month_data[m]?.expense ?? null);

      // Calculer l'intégrale cumulative du solde (chartResult), skip null values
      let cumsum = 0;
      this.chartResult = allMonths.map(month => {
        const diff = this.month_data[month] ? (this.month_data[month].revenue - this.month_data[month].expense) : null;
        if (diff !== null) {
          cumsum += diff;
          return cumsum;
        } else {
          return null;
        }
      });

      // Mettre à jour barChartData avec les couleurs dynamiques et une nouvelle référence pour la détection de changement
      this.barChartData = {
        ...this.barChartData,
        labels: this.chartLabels,
        datasets: [
          {
            ...this.barChartData.datasets[0],
            data: this.chartRevenue,
            backgroundColor: primary + '99', // 60% opacity
            borderColor: primary
          },
          {
            ...this.barChartData.datasets[1],
            data: this.chartExpense,
            backgroundColor: secondary + '99', // 60% opacity
            borderColor: secondary
          },
          {
            ...this.barChartData.datasets[2],
            data: this.chartResult,
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
  };



  calculate_monthly_data(): { [key: string]: { revenue: number, expense: number } } {
    this.month_data = {};
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

