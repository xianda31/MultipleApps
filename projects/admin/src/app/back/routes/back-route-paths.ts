
// Chemins relatifs pour le routing Angular (back.routes.ts)
export const BACK_ROUTE_PATHS = {
  Shop: 'caisse/ventes',
  FeesCollector: 'caisse/droits-de-table',
  Products: 'caisse/produits',
  MembersDatabase: 'members/database',
  GameCardsEditor: 'members/cartes-admission',
  MemberSales: 'members/controls',
  CashBoxStatus: 'finance/état-de-caisse',
  BankReconciliation: 'finance/bank-reconciliation',
  ExpenseAndRevenue: 'finance/expense-and-revenue',
  ExpenseAndRevenueDetails: 'finance/expense-and-revenue/details',
  // BooksEditor: 'finance/toutes-ecritures',
  Balance: 'finance/balance',
  BooksOverview: 'finance/books/base-comptable',
  BooksOverviewReport: 'finance/books/base-comptable/:report',
  BooksList: 'finance/books/list',
  BooksDebugger: 'devtools/books/editor',
  BooksDebuggerId: 'devtools/books/editor/:id',
  BooksEditor: 'finance/books/editor',
  BooksEditorId: 'finance/books/editor/:id',
  SysConf: 'outils/sysconf',
  ImportExcel: 'outils/excel_import',
  GroupsList: 'outils/groups',
  CloneDB: 'outils/cloneDB',
  CloneS3: 'outils/cloneS3',
  // Snippets: 'site/thumbnails',
  RootVolume: 'outils/disk',
  FilemgrWindows: 'outils/disk/:root_folder',
  MenusEditor: 'site/menus',
  UiConf: 'site/ui',
  Competitions: 'site/competitions',
  Home: 'home',
  Assistance: 'communication/assistance',
  Mailing: 'communication/mailing',
  CMSWrapper:'site/cms-wrapper',
  SignOut: 'signout'
};

// Chemins absolus pour la navigation (service, liens, etc.)
export const BACK_ROUTE_ABS_PATHS = Object.fromEntries(
  Object.entries(BACK_ROUTE_PATHS).map(([k, v]) => [k, '/back/' + v])
);

// Navigation helpers - fonctions pour construire les chemins avec paramètres
export const BACK_ROUTE_NAV = {
  pageEditor: (pageId: string, queryParams?: { from?: string }) => {
    const path = `/back/site/pages-editor/${pageId}`;
    return queryParams?.from ? `${path}?from=${queryParams.from}` : path;
  },
  booksEditorFull: (id?: string) => 
    id ? `/back/finance/books/editor/${id}` : '/back/finance/books/editor',
  booksOverviewReport: (report: string) => 
    `/back/finance/books/base-comptable/${report}`,
  filemgrWindows: (rootFolder: string) => 
    `/back/site/disk/${rootFolder}`,
};
