
import { Injectable } from '@angular/core';
import { ChartOptions, Chart } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import {
  defaultPlayerChartData,
  defaultPlayerChartOptions,
  defaultExpensesAndRevenuesChartOptions,
  defaultMemberAgeDistributionChartData,
  defaultMemberAgeDistributionChartOptions,
} from './dashboard.graph.definition';
import { Balance_sheet } from '../../common/interfaces/balance.interface';

// borderRadius nettoyé
Chart.register(ChartDataLabels);


@Injectable({
  providedIn: 'root'

})
export class DashboardGraphService {

  private getChartColors(): { primary: string, secondary: string, info: string } {
    const root = getComputedStyle(document.documentElement);
    return {
      primary: root.getPropertyValue('--color-primary').trim(),
      secondary: root.getPropertyValue('--color-secondary').trim(),
      info: root.getPropertyValue('--color-info').trim()
    };
  }

  buildMemberAgeDistributionChart(
    ageGroups: string[],
    countsMale: number[],
    countsFemale: number[]
  ): { data: any, options: ChartOptions<any> } {
    const { primary, secondary } = this.getChartColors();
    return {
      data: {
        labels: ageGroups,
        datasets: [
          {
            label: 'Hommes',
            data: countsMale,
            backgroundColor: primary + '99',
            borderColor: primary,
            borderWidth: 2,
            borderRadius: 1,
            stack: 'Stack 0'
          },
          {
            label: 'Femmes',
            data: countsFemale,
            backgroundColor: secondary + '99',
            borderColor: secondary,
            borderWidth: 2,
            borderRadius: 1,
            stack: 'Stack 0'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: false, text: "Distribution par tranche d'âge" },
          datalabels: { display: false }
        },
        scales: {
          x: { title: { display: false, text: "Tranche d'âge" }, stacked: true },
          y: { title: { display: true, text: 'Nombre de membres' }, beginAtZero: true, stacked: true }
        }
      } as ChartOptions<any>
    };
  }

  buildExpensesAndRevenuesChart(
    allMonths: string[],
    chartRevenue: (number | null)[],
    chartExpense: (number | null)[],
    chartResult: (number | null)[]
  ): { data: any, options: ChartOptions<any> } {
    const { primary, secondary, info } = this.getChartColors();
    return {
      data: {
        labels: allMonths,
        datasets: [
          {
            label: 'Revenus',
            data: chartRevenue,
            backgroundColor: primary + '99',
            borderColor: primary,
            borderWidth: 2,
            borderRadius: 1,
            datalabels: { display: false }
          },
          {
            label: 'Dépenses',
            data: chartExpense,
            backgroundColor: secondary + '99',
            borderColor: secondary,
            borderWidth: 2,
            borderRadius: 1,
            datalabels: { display: false }
          },
          {
            type: 'line',
            label: 'Résultat',
            data: chartResult,
            borderColor: info,
            backgroundColor: info + '1A',
            pointBackgroundColor: info,
            pointRadius: 5,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            datalabels: {
              display: (context: any) => {
                // Afficher le label uniquement sur le dernier point avec une valeur non-null
                const data = context.dataset.data;
                for (let i = data.length - 1; i >= 0; i--) {
                  if (data[i] !== null && data[i] !== undefined) {
                    return context.dataIndex === i;
                  }
                }
                return false;
              },
              align: 'right',
              anchor: 'end',
              offset: 8,
              font: {
                size: 14,
                weight: 'bold'
              },
              color: info,
              formatter: (value: number | null) => {
                if (value === null || value === undefined) return '';
                return value.toFixed(0) + ' €';
              }
            }
          }
        ]
      },
      options: defaultExpensesAndRevenuesChartOptions
    };
  }

  buildPlayerChart(
    allMonths: string[],
    playerCounts: (number | null)[],
    tournamentCounts: (number | null)[],
    playerCountAverage: number,
    tournamentCountAverage: number
  ): { data: any, options: ChartOptions<any> } {
    const { primary, info } = this.getChartColors();
    const options = JSON.parse(JSON.stringify(defaultPlayerChartOptions)) as ChartOptions<'bar'>;

    // Appliquer les couleurs aux axes
    if (options.scales) {
      if (options.scales['y']) {
        (options.scales['y'] as any).ticks = { ...(options.scales['y'] as any).ticks, color: primary };
        (options.scales['y'] as any).title = { ...(options.scales['y'] as any).title, color: primary };
      }
      if (options.scales['y1']) {
        (options.scales['y1'] as any).ticks = { ...(options.scales['y1'] as any).ticks, color: info };
        (options.scales['y1'] as any).title = { ...(options.scales['y1'] as any).title, color: info };
      }
    }

    return {
      data: {
        labels: allMonths,
        datasets: [
          {
            ...defaultPlayerChartData.datasets[0],
            data: playerCounts,
            backgroundColor: primary + '99',
            borderColor: primary,
            borderWidth: 2,
            borderRadius: 1,
            yAxisID: 'y'
          },
          {
            ...defaultPlayerChartData.datasets[1],
            type: 'line',
            data: tournamentCounts,
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
            data: allMonths.map(() => playerCountAverage),
            label: 'Moy. Paires',
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
            data: allMonths.map(() => tournamentCountAverage),
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
      },
      options
    };
  }

  buildBalanceChart(
    balanceSheets: Balance_sheet[]
  ): { data: any, options: ChartOptions<any> } {
    const { primary, secondary, info } = this.getChartColors();

    // Trier les balance_sheets par saison chronologiquement
    const sortedSheets = [...balanceSheets].sort((a, b) => {
      return a.season.localeCompare(b.season);
    });

    // Extraire les saisons et les données
    const seasons = sortedSheets.map(sheet => sheet.season);
    const savingsData = sortedSheets.map(sheet => sheet.savings);
    const bankData = sortedSheets.map(sheet => sheet.bank);
    const cashboxData = sortedSheets.map(sheet => sheet.cashbox);
    const wipTotalData = sortedSheets.map(sheet => sheet.wip_total);

    // Calculer l'offset invisible (hauteur = sum de Stack 0 + wip_total)
    const invisibleOffsetData = sortedSheets.map(sheet =>
      sheet.savings + sheet.bank + sheet.cashbox + sheet.wip_total
    );

    // Calculer la hauteur "En cours" (-wip_total pour l'effet waterfall)
    const wipDisplayData = sortedSheets.map(sheet => -sheet.wip_total);

    return {
      data: {
        labels: seasons,
        datasets: [
          {
            label: 'Épargne',
            data: savingsData,
            backgroundColor: primary + '99',
            borderColor: primary,
            borderWidth: 2,
            borderRadius: 1,
            stack: 'Stack 0',
            datalabels: { display: false }
          },
          {
            label: 'Banque',
            data: bankData,
            backgroundColor: secondary + '99',
            borderColor: secondary,
            borderWidth: 2,
            borderRadius: 4,
            stack: 'Stack 0',
            datalabels: { display: false }
          },
          {
            label: 'Caisse',
            data: cashboxData,
            backgroundColor: info + '99',
            borderColor: info,
            borderWidth: 2,
            borderRadius: 4,
            stack: 'Stack 0',
            datalabels: { display: false }
          },
          {
            label: '', // Barre invisible pour l'offset waterfall
            data: invisibleOffsetData,
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 0,
            borderRadius: { topLeft: 1, topRight: 1, bottomLeft: 1, bottomRight: 1 },
            stack: 'Stack 1',
            pointRadius: 0,
            datalabels: {
              display: true,
              align: 'center',
              anchor: 'center',
              offset: 0,
              font: {
                size: 14,
                weight: 'bold'
              },
              color: info,
              formatter: (value: number | null) => {
                if (value === null || value === undefined) return '';
                return value.toFixed(0) + ' €';
              }
            }
          },
          {
            label: 'En cours',
            data: wipDisplayData,
            backgroundColor: '#FF6B6B99',
            borderColor: '#FF6B6B',
            borderWidth: 3,
            borderSkipped: false,
            borderRadius: { topLeft: 1, topRight: 1, bottomLeft: 1, bottomRight: 1 },
            stack: 'Stack 1',
            datalabels: { display: false }
          },
          {
            type: 'line',
            label: 'Total actif',
            data: invisibleOffsetData,
            borderColor: info,
            backgroundColor: info + '1A',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: info,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointStyle: 'circle',
            fill: false,
            clip: false,
            datalabels: { display: false }
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: false, text: 'Bilan par saison' },
          // Plugin pour repositionner les points au milieu de la barre "En cours"
          pointPositioner: {
            id: 'pointPositioner',
            afterDatasetsDraw(chart: any) {
              const ctx = chart.ctx;
              const datasetIndex = 5; // Index du dataset "Total actif"
              const dataset = chart.data.datasets[datasetIndex];
              const meta = chart.getDatasetMeta(datasetIndex);

              // Récupérer les données de wip_total (dataset 4)
              const wipDataset = chart.data.datasets[4];

              for (let i = 0; i < meta.data.length; i++) {
                const point = meta.data[i];
                // Décaler le point visuellement de la moitié de la hauteur de la barre "En cours"
                const yScale = chart.scales.y;
                const wipValue = wipDataset.data[i];
                const offsetPixels = (Math.abs(wipValue) / 2) * (yScale.bottom - yScale.top) / (yScale.max - yScale.min);
                point.y = point.y + offsetPixels;
              }
            }
          } as any
        },
        scales: {
          x: { title: { display: false, text: 'Saison' } },
          y: { title: { display: true, text: 'Montant (€)' }, beginAtZero: true, stacked: true }
        }
      } as ChartOptions<any>
    };
  }

  getDefaultFinancialChartData() {
    return {};
  }

  getDefaultPlayerChartData() {
    return defaultPlayerChartData;
  }

  getDefaultPlayerChartOptions(): ChartOptions<'bar'> {
    return defaultPlayerChartOptions;
  }

  getDefaultFinancialChartOptions(): ChartOptions<'bar'> {
    return defaultExpensesAndRevenuesChartOptions;
  }

  getDefaultMemberAgeDistributionChartData() {
    return defaultMemberAgeDistributionChartData;
  }

  getDefaultMemberAgeDistributionChartOptions(): ChartOptions<'bar'> {
    return defaultMemberAgeDistributionChartOptions;
  }

  buildIVDistributionChart(
    series: string[],
    dataByCodeAndSerie: { [codeWithSerie: string]: { count: number, iv: number } },
    suffixOrder: string[]
  ): { data: any, options: ChartOptions<any> } {
    // Couleur par suffixe avec noms de symboles de cartes
    const colorMap = this.getIVSuffixColorMap();

    // Créer un dataset par suffixe
    const datasets = suffixOrder.map(suffix => {
      const data = series.map(serie => {
        const key = `${serie}|${suffix}`;
        return dataByCodeAndSerie[key]?.count || 0;
      });

      const color = colorMap[suffix] || '#999999';

      return {
        label: suffix,
        data,
        backgroundColor: color + '99',
        borderColor: color,
        borderWidth: 2,
        borderRadius: 4,
        stack: 'Stack 0',
      };
    });

    return {
      data: {
        labels: series,
        datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: false, text: 'Distribution des valeurs IV par série' },
          datalabels: { display: false }
        },
        scales: {
          x: { title: { display: false, text: 'Série' }, stacked: true },
          y: { title: { display: true, text: 'Nombre de membres' }, beginAtZero: true, stacked: true }
        }
      } as ChartOptions<any>
    };
  }

  getIVSuffixColorMap() {
    const map = {
      'NvL': '#AAAAAA',  // Non classé (gris clair)
      'T': '#228B22',    // Trèfle (vert)
      'K': '#db5e25',    // Carreau (orange)
      'C': '#E31B23',    // Coeur (rouge vif)
      'P': '#1C1C1C',    // Pique (noir)
      'Pr': '#ad9f4e',    // Promotion (dorée)
      'H': '#bb9823'   // Autres (dorée ++)
    };
    return map as { [key: string]: string };
  }

  public buildRevenuesAndExpensesBySectionChart(
    per_section_revenues: { [section: string]: number },
    per_section_expenses: { [section: string]: number }
  ): { data: any, options: ChartOptions<any> } {
    const { primary, secondary, info } = this.getChartColors();

    const sections = Object.keys(per_section_revenues);
    const revenues = sections.map(section => per_section_revenues[section] || 0);
    const expenses = sections.map(section => per_section_expenses[section] || 0);

    return {
      data: {
        labels: sections,
        datasets: [
          {
            label: 'Revenus',
            data: revenues,
            backgroundColor: primary + '99',
            borderColor: primary,
            borderWidth: 2,
            borderRadius: 4
          },
          {
            label: 'Dépenses',
            data: expenses,
            backgroundColor: secondary + '99',
            borderColor: secondary,
            borderWidth: 2,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: false,
            text: 'Revenus et dépenses par section'
          },
          datalabels: {
            display: false
          }
        },
        scales: {
          x: {
            stacked: false,
            ticks: { font: { size: 12 } }
          },
          y: {
            stacked: false,
            beginAtZero: true,
            ticks: { font: { size: 12 } },
            title: { display: true, text: 'Montant (€)', font: { size: 13 } }
          }
        }
      } as ChartOptions<any>
    };
  }
}
