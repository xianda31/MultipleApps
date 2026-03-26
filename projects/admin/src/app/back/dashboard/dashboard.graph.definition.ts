

import { ChartOptions } from 'chart.js';

export const defaultExpensesAndRevenuesChartData = {
  labels: [],
  datasets: [
    {
      data: [],
      label: 'Revenus',
      backgroundColor: '',
      borderColor: '',
        borderRadius: 0
      },
      {
        data: [],
      borderRadius: 4
    },
    {
      data: [],
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
      label: 'Paires',
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
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: false,
      text: 'Paires et tournois par mois'
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
      type: 'linear' as const,
      display: true,
      position: 'left' as const,
      stacked: false,
      beginAtZero: true,
      grid: { display: true },
      ticks: { font: { size: 12 } },
      title: { display: true, text: 'Paires', font: { size: 12 } }
    },
    y1: {
      type: 'linear' as const,
      display: true,
      position: 'right' as const,
      beginAtZero: true,
      grid: { drawOnChartArea: false },
      ticks: { font: { size: 12 } },
      title: { display: true, text: 'Tournois', font: { size: 12 } }
    }
  }
};

export const defaultExpensesAndRevenuesChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: false,
      text: 'Recettes, dépenses et résultat par mois'
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
      grid: { display: true },
      ticks: { font: { size: 12 } },
      title: { display: true, text: 'Montant (€)', font: { size: 12 } }
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
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: false, text: "Distribution par tranche d'âge" },
    datalabels: { display: false }
  },
  scales: {
    x: { title: { display: false, text: "Tranche d'âge" }, ticks: { font: { size: 12 } } },
    y: { title: { display: true, text: 'Nombre de membres', font: { size: 12 } }, beginAtZero: true, ticks: { font: { size: 12 } } }
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
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: false, text: 'Distribution des valeurs IV' },
    datalabels: { display: false }
  },
  scales: {
    x: { title: { display: false, text: 'Plage IV' }, ticks: { font: { size: 12 } } },
    y: { title: { display: true, text: 'Nombre de membres', font: { size: 12 } }, beginAtZero: true, ticks: { font: { size: 12 } } }
  }
};

// Graphique des bilans (bar chart stacked)
export const defaultBalanceChartData = {
  labels: [],
  datasets: [
    {
      data: [],
      label: 'Épargne',
      backgroundColor: '',
      borderColor: '',
      borderWidth: 2,
      borderRadius: 4,
      stack: 'Stack 0'
    },
    {
      data: [],
      label: 'Banque',
      backgroundColor: '',
      borderColor: '',
      borderWidth: 2,
      borderRadius: 4,
      stack: 'Stack 0'
    },
    {
      data: [],
      label: 'Caisse',
      backgroundColor: '',
      borderColor: '',
      borderWidth: 2,
      borderRadius: 4,
      stack: 'Stack 0'
    },
    {
      data: [],
      label: 'En cours',
      backgroundColor: '',
      borderColor: '',
      borderWidth: 2,
      borderRadius: 4,
      stack: 'Stack 1'
    }
  ]
};

export const defaultBalanceChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: false, text: 'Bilan par saison' },
    datalabels: {
      display: false,
      font: { size: 0 }
    }
  },
  scales: {
    x: { title: { display: false, text: 'Saison' }, ticks: { font: { size: 12 } } },
    y: { title: { display: true, text: 'Montant (€)', font: { size: 12 } }, beginAtZero: true, stacked: true, ticks: { font: { size: 12 } } }
  }
};

// Graphiques camembert pour revenus et dépenses
export const defaultRevenuesPieChartData = {
  labels: [],
  datasets: [
    {
      data: [],
      label: 'Revenus',
      backgroundColor: [],
      borderColor: '#fff',
      borderWidth: 2
    }
  ]
};

export const defaultRevenuesPieChartOptions: ChartOptions<'pie'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: { font: { size: 12 }, padding: 15 }
    },
    title: {
      display: false,
      text: 'Revenus par catégorie'
    },
    datalabels: {
      display: true,
      font: { size: 12, weight: 'bold' },
      formatter: (value: number) => {
        return value.toFixed(0) + ' €';
      }
    }
  }
};

export const defaultExpensesPieChartData = {
  labels: [],
  datasets: [
    {
      data: [],
      label: 'Dépenses',
      backgroundColor: [],
      borderColor: '#fff',
      borderWidth: 2
    }
  ]
};

export const defaultExpensesPieChartOptions: ChartOptions<'pie'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: { font: { size: 12 }, padding: 15 }
    },
    title: {
      display: false,
      text: 'Dépenses par catégorie'
    },
    datalabels: {
      display: true,
      font: { size: 12, weight: 'bold' },
      formatter: (value: number) => {
        return value.toFixed(0) + ' €';
      }
    }
  }
};
