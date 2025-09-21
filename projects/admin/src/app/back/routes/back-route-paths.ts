// Chemins relatifs pour le routing Angular (back.routes.ts)
export const BACK_ROUTE_PATHS = {
  Shop: 'caisse/ventes',
  FeesCollector: 'caisse/droits-de-table',
  Products: 'caisse/produits',
  MembersDatabase: 'members/database',
  GameCardsEditor: 'members/cartes-admission',
  MemberSales: 'members/payments',
  CashBoxStatus: 'finance/état-de-caisse',
  BankReconciliation: 'finance/bank-reconciliation',
  ExpenseAndRevenue: 'finance/expense-and-revenue',
  ExpenseAndRevenueDetails: 'finance/expense-and-revenue/details',
  BooksEditor: 'finance/toutes-ecritures',
  Balance: 'finance/balance',
  BooksOverview: 'finance/books/base-comptable',
  BooksOverviewReport: 'finance/books/base-comptable/:report',
  BooksList: 'finance/books/list',
  BooksEditorFull: 'finance/books/editor',
  BooksEditorFullId: 'finance/books/editor/:id',
  SysConf: 'outils/sysconf',
  ImportExcel: 'outils/excel_import',
  GroupsList: 'outils/groups',
  CloneDB: 'outils/cloneDB',
  Snippets: 'site/thumbnails',
  RootVolume: 'site/disk',
  FilemgrWindows: 'site/disk/:root_folder',
  PagesEditor: 'site/pages',
  Home: 'home',
};

// Chemins absolus pour la navigation (service, liens, etc.)
export const BACK_ROUTE_ABS_PATHS = Object.fromEntries(
  Object.entries(BACK_ROUTE_PATHS).map(([k, v]) => [k, '/back/' + v])
);
