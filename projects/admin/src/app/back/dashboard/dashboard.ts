import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { BookService } from '../services/book.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { Revenue, Expense, BookEntry, CUSTOMER_ACCOUNT } from '../../common/interfaces/accounting.interface';
import { TournamentService } from '../../common/services/tournament.service';
import { Observable, map, switchMap } from 'rxjs';
import { DashboardGraphService } from './dashboard.graph.service';
import { MembersService } from '../../common/services/members.service';
import { FinancialReportService } from '../services/financial_report.service';
import { Balance_board, Balance_sheet } from '../../common/interfaces/balance.interface';
import { Revenue_and_expense_definition } from '../../common/interfaces/system-conf.interface';

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
  season!: string;
  expensesAndRevenuesChartData: any = {};
  expensesAndRevenuesChartOptions!: ChartOptions<any>;
  balanceChartData: any = {};
  balanceChartOptions!: ChartOptions<any>;
  playerChartData: any = {};
  playerChartOptions!: ChartOptions<any>;
  memberChartData: any = {};
  memberChartOptions !: ChartOptions<any>
  ivChartData: any = {};
  ivChartOptions!: ChartOptions<any>;
  ivSuffixColorMap!: { [suffix: string]: string };
  
  revenuseAndExpensesBySectionChartData: any = {};
  revenuseAndExpensesBySectionChartOptions!: ChartOptions<any>;

  playerCountAverage  !: number;
  teamPerTournamentAverage !: number;
  tournamentCountAverage!: number;
  membersCount!: number;
  averageMaleAge!: number;
  averageFemaleAge!: number;

  p_and_l_sections: { key: string, description: string }[] = [];
  revenue_definitions: Revenue_and_expense_definition[] = [];
  expense_definitions: Revenue_and_expense_definition[] = [];

  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private tournamentService: TournamentService,
    private graphService: DashboardGraphService,
    private memberService: MembersService,
    private financialService: FinancialReportService,
  ) {
    this.ivSuffixColorMap = this.graphService.getIVSuffixColorMap();
  }


  ngOnInit() {

    this.systemDataService.get_configuration().subscribe((conf) => {
      // Générer tous les mois de la saison courante (juillet à juin)
      this.season = conf.season;
      this.p_and_l_sections = conf.revenue_and_expense_tree.sections;
      this.revenue_definitions = conf.revenue_and_expense_tree.revenues;
      this.expense_definitions = conf.revenue_and_expense_tree.expenses;
      this.startYear = parseInt(this.season.slice(0, 4));
      this.allMonths = this.generateSeasonMonths(this.startYear);


      this.initialize_financial_data(this.allMonths).subscribe(({ chartRevenue, chartExpense, chartResult }) => {

        ({ data: this.expensesAndRevenuesChartData, options: this.expensesAndRevenuesChartOptions } = this.graphService.buildExpensesAndRevenuesChart(
          this.allMonths,
          chartRevenue,
          chartExpense,
          chartResult
        ));

        this.initialize_balance_data(this.season).subscribe((balance_sheets) => {
          ({ data: this.balanceChartData, options: this.balanceChartOptions } = this.graphService.buildBalanceChart(
            balance_sheets
          ));
        });


       let {  per_section_revenues, per_section_expenses } =  this.initialize_results_data(); // pour calculer le résultat de la saison en cours, utilisé dans check_balance_vs_profit_and_loss()

        ({ data: this.revenuseAndExpensesBySectionChartData, options: this.revenuseAndExpensesBySectionChartOptions } = this.graphService.buildRevenuesAndExpensesBySectionChart(
          per_section_revenues,
          per_section_expenses
        ));
      });


      this.initialize_tournaments_data(this.allMonths).subscribe(({ pairCounts, tournamentCounts }) => {
        // Calculer les moyennes
        const nonNullPairCounts = pairCounts.filter(c => c !== null) as number[];
        const nonNullTournamentCounts = tournamentCounts.filter(c => c !== null) as number[];
        this.playerCountAverage = nonNullPairCounts.length > 0 ? nonNullPairCounts.reduce((a, b) => a + b, 0) / nonNullPairCounts.length : 0;
        this.tournamentCountAverage = nonNullTournamentCounts.length > 0 ? nonNullTournamentCounts.reduce((a, b) => a + b, 0) / nonNullTournamentCounts.length : 0;
        this.teamPerTournamentAverage = this.tournamentCountAverage > 0 ? this.playerCountAverage / this.tournamentCountAverage : 0;

        ({ data: this.playerChartData, options: this.playerChartOptions } = this.graphService.buildPlayerChart(
          this.allMonths,
          pairCounts,
          tournamentCounts,
          this.playerCountAverage,
          this.tournamentCountAverage
        ));
      });

      this.initialize_members_data().subscribe(({ age_groups, group_counts_male, group_counts_female }) => {
        const countsMale = age_groups.map(g => group_counts_male[g] || 0);
        const countsFemale = age_groups.map(g => group_counts_female[g] || 0);
        ({ data: this.memberChartData, options: this.memberChartOptions } = this.graphService.buildMemberAgeDistributionChart(
          age_groups,
          countsMale,
          countsFemale
        ));
      });

      this.initialize_iv_data().subscribe(({ series, dataByCodeAndSerie, suffixOrder }) => {
        ({ data: this.ivChartData, options: this.ivChartOptions } = this.graphService.buildIVDistributionChart(
          series,
          dataByCodeAndSerie,
          suffixOrder
        ));
      });

    });
  }

  initialize_balance_data(season: string): Observable<Balance_sheet[]> {

    return this.financialService.read_balance_sheets_from_S3().pipe(
      map((balance_sheets) => {
        const balance_board: Balance_board = this.financialService.compute_balance_board(season);
        balance_sheets.push(balance_board.current);
        return balance_sheets;
      })
    );
  }

  initialize_results_data(): {  per_section_revenues: { [section: string]: number }, per_section_expenses: { [section: string]: number } } {
    // book_entries supposed to be loaded before,
    let per_section_revenues: { [section: string]: number } = {};
    let per_section_expenses: { [section: string]: number } = {};

    this.revenue_definitions.forEach(def => {
      if (!per_section_revenues[def.section]) {
        per_section_revenues[def.section] = 0;
      }
      per_section_revenues[def.section] += this.bookService.get_total_revenues(def.key);
    });
    this.expense_definitions.forEach(def => {
      if (!per_section_expenses[def.section]) {
        per_section_expenses[def.section] = 0;
      }
      per_section_expenses[def.section] += this.bookService.get_total_expenses(def.key);
    });
    return { per_section_revenues, per_section_expenses };
    
  }

  initialize_members_data(ageStep: number = 5): Observable<{
    age_groups: string[],
    // group_counts: { [age_group: string]: number },
    group_counts_male: { [age_group: string]: number },
    group_counts_female: { [age_group: string]: number }
  }> {
    return this.memberService.listMembers().pipe(
      map(members => members.filter(m => m.membership_date)), // Filtrer les membres ayant payé leur cotisation
      map(members => {
        this.membersCount = members.length;
        const now = new Date();
        // Calculer l'âge et le genre de chaque membre
        const agesWithGender = members
          .map(m => {
            if (!m.birthdate) return null;
            const birth = new Date(m.birthdate);
            if (isNaN(birth.getTime())) return null;
            let age = now.getFullYear() - birth.getFullYear();
            const mDiff = now.getMonth() - birth.getMonth();
            if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) {
              age--;
            }
            return { age, gender: m.gender };
          })
          .filter(a => a !== null && a.age >= 0) as { age: number, gender: any }[];

        const ages = agesWithGender.map(a => a.age);
        // Déterminer la borne min et max
        const maxAge = Math.max(...ages, 0);
        const minAge = Math.min(...ages, 0);
        // Arrondir la borne min à l'inférieur multiple de ageStep
        const minGroup = Math.floor(minAge / ageStep) * ageStep;
        // Créer les tranches minGroup-minGroup+ageStep-1, ...
        let age_groups: string[] = [];
        const group_counts: { [age_group: string]: number } = {};
        const group_counts_male: { [age_group: string]: number } = {};
        const group_counts_female: { [age_group: string]: number } = {};
        for (let min = minGroup; min <= maxAge; min += ageStep) {
          const max = min + ageStep - 1;
          const label = `${min}-${max}`;
          age_groups.push(label);
          group_counts[label] = 0;
          group_counts_male[label] = 0;
          group_counts_female[label] = 0;
        }
        // Compter les membres dans chaque tranche et par genre
        for (const { age, gender } of agesWithGender) {
          const groupIdx = Math.floor((age - minGroup) / ageStep);
          const label = age_groups[groupIdx] || `${minGroup + ageStep * groupIdx}-${minGroup + ageStep * groupIdx + ageStep - 1}`;
          if (!(label in group_counts)) {
            group_counts[label] = 0;
            group_counts_male[label] = 0;
            group_counts_female[label] = 0;
            if (!age_groups.includes(label)) age_groups.push(label);
          }
          group_counts[label]++;
          if (gender === 1 || gender === 'M.') {
            group_counts_male[label]++;
          } else if (gender === 0 || gender === 'Mme') {
            group_counts_female[label]++;
          } else {
            group_counts_female[label]++;
          }
        }

        // calculer la moyenne d'âge par genre
        const totalMale = agesWithGender.filter(a => a.gender === 1 || a.gender === 'M.').length;
        const totalFemale = agesWithGender.filter(a => a.gender === 0 || a.gender === 'Mme').length;
        this.averageMaleAge = totalMale > 0 ? agesWithGender.filter(a => a.gender === 1 || a.gender === 'M.').reduce((sum, a) => sum + a.age, 0) / totalMale : 0;
        this.averageFemaleAge = totalFemale > 0 ? agesWithGender.filter(a => a.gender === 0 || a.gender === 'Mme').reduce((sum, a) => sum + a.age, 0) / totalFemale : 0;

        // Supprimer les premières tranches vides
        while (age_groups.length > 0 && group_counts[age_groups[0]] === 0) {
          delete group_counts[age_groups[0]];
          delete group_counts_male[age_groups[0]];
          delete group_counts_female[age_groups[0]];
          age_groups.shift();
        }
        return { age_groups, group_counts, group_counts_male, group_counts_female };
      }));
  }

  initialize_iv_data(step: number = 10): Observable<{
    series: string[],
    dataByCodeAndSerie: { [codeWithSerie: string]: { count: number, iv: number } },
    suffixOrder: string[]
  }> {
    return this.memberService.listMembers().pipe(
      map(members => members.filter(m => m.membership_date)), // Filtrer les membres ayant payé leur cotisation

      map(members => {
        // Récupérer les membres avec iv_code et iv valides
        const membersWithIVCode = members
          .filter(m => m.iv_code && m.iv !== null && m.iv !== undefined && typeof m.iv === 'number');

        if (membersWithIVCode.length === 0) {
          return { series: [], dataByCodeAndSerie: {}, suffixOrder: [] };
        }

        const series = ['NvL', '4', '3', '2', '1'];
        const dataByCodeAndSerie: { [codeWithSerie: string]: { count: number, iv: number } } = {};
        const suffixMap: { [suffix: string]: number } = {}; // suffix -> min IV

        // Extraire la série et le suffixe de chaque iv_code
        for (const member of membersWithIVCode) {
          const code = member.iv_code!;
          const iv = member.iv!;

          let serie = '';
          let suffix = '';

          // Déterminer la série et le suffixe
          if (code.startsWith('NvL')) {
            serie = 'NvL';
            const remaining = code.substring(3); // Tout ce qui suit "NvL"
            // Extraire le suffixe (dernier caractère ou "Pr" si en fin)
            suffix = remaining.endsWith('Pr') ? 'Pr' : remaining.charAt(remaining.length - 1) || '';
          } else if (code.length > 0 && /^[1-4]/.test(code)) {
            serie = code.charAt(0);
            const remaining = code.substring(1);
            // Extraire le suffixe (dernier caractère ou "Pr" si en fin)
            suffix = remaining.endsWith('Pr') ? 'Pr' : remaining.charAt(remaining.length - 1) || '';
          } else {
            continue;
          }

          // Compter
          const key = `${serie}|${suffix}`;
          if (!dataByCodeAndSerie[key]) {
            dataByCodeAndSerie[key] = { count: 0, iv };
          }
          dataByCodeAndSerie[key].count++;

          // Tracker l'IV min pour chaque suffixe
          if (!suffixMap[suffix] || iv < suffixMap[suffix]) {
            suffixMap[suffix] = iv;
          }
        }

        // Trier les suffixes par min IV
        const suffixOrder = Object.keys(suffixMap)
          .sort((a, b) => suffixMap[a] - suffixMap[b]);

        return { series, dataByCodeAndSerie, suffixOrder };
      }));
  }

  initialize_tournaments_data(chartLabels: string[]): Observable<{ pairCounts: (number | null)[], tournamentCounts: (number | null)[] }> {
    // Initialise les données paires (équipes) et tournois par mois
    const daysBack = Math.ceil((new Date().getTime() - new Date(`${this.startYear}-07-01`).getTime()) / (1000 * 60 * 60 * 24));

    return this.tournamentService.list_next_tournaments(daysBack).pipe(
      map((trns) => {
        let pairCountsByMonth: { [month: string]: number } = {};
        let tournamentCountByMonth: { [month: string]: number } = {};
        trns.forEach(trn => {
          const d = new Date(trn.date);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const key = `${yyyy}-${mm}`;
          const totalInscrit = typeof trn.nbr_inscrit === 'number' ? trn.nbr_inscrit : parseInt(trn.nbr_inscrit, 10);
          // Calculer le nombre de paires: (total - joueurs isolés) / 2
          const isolatedCount = trn.has_isolated_player ? 1 : 0;
          const pairCount = Math.floor((totalInscrit - isolatedCount) / 2);
          pairCountsByMonth[key] = (pairCountsByMonth[key] || 0) + (isNaN(pairCount) ? 0 : pairCount);
          tournamentCountByMonth[key] = (tournamentCountByMonth[key] || 0) + 1;
        });
        const pairCounts: (number | null)[] = chartLabels.map(m => pairCountsByMonth[m] ?? null);
        const tournamentCounts: (number | null)[] = chartLabels.map(m => tournamentCountByMonth[m] ?? null);


        return { pairCounts, tournamentCounts };
      })
    );
  }

  initialize_financial_data(chartLabels: string[]): Observable<{ chartRevenue: (number | null)[], chartExpense: (number | null)[], chartResult: (number | null)[] }> {

    return this.bookService.list_book_entries().pipe(
      map((book_entries: BookEntry[]) => {

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

