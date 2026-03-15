
import { Injectable } from '@angular/core';
import { ChartOptions } from 'chart.js';
import {
  defaultFinancialChartData,
  defaultPlayerChartData,
  defaultPlayerChartOptions,
  defaultFinancialChartOptions,
  defaultMemberAgeDistributionChartData,
  defaultMemberAgeDistributionChartOptions,
} from './dashboard.graph.definition';


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
            borderRadius: 4,
            stack: 'Stack 0',
          },
          {
            label: 'Femmes',
            data: countsFemale,
            backgroundColor: secondary + '99',
            borderColor: secondary,
            borderWidth: 2,
            borderRadius: 4,
            stack: 'Stack 0',
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: false, text: "Distribution par tranche d'âge" }
        },
        scales: {
          x: { title: { display: false, text: "Tranche d'âge" }, stacked: true },
          y: { title: { display: true, text: 'Nombre de membres' }, beginAtZero: true, stacked: true }
        }
      } as ChartOptions<any>
    };
  }

  buildFinancialChart(
    allMonths: string[],
    chartRevenue: (number | null)[],
    chartExpense: (number | null)[],
    chartResult: (number | null)[]
  ): {data:any, options:ChartOptions<any>} {
    const { primary, secondary, info } = this.getChartColors();
    return {
        data: {
      labels: allMonths,
      datasets: [
        {
          ...defaultFinancialChartData.datasets[0],
          data: chartRevenue,
          backgroundColor: primary + '99',
          borderColor: primary
        },
        {
          ...defaultFinancialChartData.datasets[1],
          data: chartExpense,
          backgroundColor: secondary + '99',
          borderColor: secondary
        },
        {
          ...defaultFinancialChartData.datasets[2],
          type: 'line',
          data: chartResult,
          borderColor: info,
          backgroundColor: info + '1A',
          pointBackgroundColor: info,
          pointRadius: 5,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]},
      options: defaultFinancialChartOptions
    };
  }

  buildPlayerChart(
    allMonths: string[],
    playerCounts: (number | null)[],
    tournamentCounts: (number | null)[],
    playerCountAverage: number,
    tournamentCountAverage: number
  ): {data:any, options:ChartOptions<any>} {
    const { primary, info } = this.getChartColors();
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
            borderRadius: 4,
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
      options: defaultPlayerChartOptions
    };
  }

  getDefaultFinancialChartData() {
    return defaultFinancialChartData;
  }
  getDefaultPlayerChartData() {
    return defaultPlayerChartData;
  }
  getDefaultPlayerChartOptions(): ChartOptions<'bar'> {
    return defaultPlayerChartOptions;
  }
  getDefaultFinancialChartOptions(): ChartOptions<'bar'> {
    return defaultFinancialChartOptions;
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
          title: { display: false, text: 'Distribution des valeurs IV par série' }
        },
        scales: {
          x: { title: { display: false, text: 'Série' }, stacked: true },
          y: { title: { display: true, text: 'Nombre de membres' }, beginAtZero: true, stacked: true }
        }
      } as ChartOptions<any>
    };
  }

  getIVSuffixColorMap(): { [suffix: string]: string } {
    return {
      'NvL': '#AAAAAA',  // Non classé (gris clair)
      'T': '#228B22',    // Trèfle (vert)
      'K': '#db5e25',    // Carreau (orange)
      'C': '#E31B23',    // Coeur (rouge vif)
      'P': '#1C1C1C',    // Pique (noir)
      'Pr': '#ad9f4e',    // Promotion (dorée)
      'H': '#bb9823'   // Autres (dorée ++)
    };
  }
}
