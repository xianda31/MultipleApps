
import { Injectable } from '@angular/core';
import { ChartOptions } from 'chart.js';
import {
  defaultFinancialChartData,
  defaultPlayerChartData,
  defaultPlayerChartOptions,
  defaultFinancialChartOptions,
  defaultMemberAgeDistributionChartData,
  defaultMemberAgeDistributionChartOptions
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
}
