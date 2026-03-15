

import { ChartOptions } from 'chart.js';

export const defaultFinancialChartData = {
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

export const defaultPlayerChartData = {
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

export const defaultPlayerChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: false
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

export const defaultFinancialChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: false
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

// Distribution d'âge des membres (bar chart)
export const defaultMemberAgeDistributionChartData = {
  labels: [],
  datasets: [
    {
      data: [],
      label: 'Membres',
      backgroundColor: '',
      borderColor: '',
      borderWidth: 2,
      borderRadius: 4
    }
  ]
};

export const defaultMemberAgeDistributionChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  plugins: {
    legend: { display: false },
    title: { display: false, text: "Distribution par tranche d'âge" }
  },
  scales: {
    x: { title: { display: false, text: "Tranche d'âge" } },
    y: { title: { display: true, text: 'Nombre de membres' }, beginAtZero: true }
  }
};

// Distribution IV des membres (bar chart)
export const defaultIVDistributionChartData = {
  labels: [],
  datasets: [
    {
      data: [],
      label: 'Membres',
      backgroundColor: '',
      borderColor: '',
      borderWidth: 2,
      borderRadius: 4
    }
  ]
};

export const defaultIVDistributionChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  plugins: {
    legend: { display: false },
    title: { display: false, text: 'Distribution des valeurs IV' }
  },
  scales: {
    x: { title: { display: false, text: 'Plage IV' } },
    y: { title: { display: true, text: 'Nombre de membres' }, beginAtZero: true }
  }
};
