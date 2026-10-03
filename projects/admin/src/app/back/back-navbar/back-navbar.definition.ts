
import { BACK_ROUTE_PATHS } from '../routes/back-route-paths';
import { NavbarMenu } from './back-navbar.interface';
import { getBackRouteMinimumLevel } from '../routes/back-route-access';

const MENU_DEFINITIONS: NavbarMenu[] = [
    {
        label: 'Tournois',
        key: 'boutique',
        icon: 'bi-card-checklist',
        route: BACK_ROUTE_PATHS.FeesCollector
    },
    {
        label: 'Boutique',
        key: 'boutique',
        icon: 'bi-cart',
        subMenus: [
            { label: 'vente adhérent', route: BACK_ROUTE_PATHS.Shop },
            { label: 'billetterie', route: BACK_ROUTE_PATHS.Billetterie },
            { label: 'produits à la vente', route: BACK_ROUTE_PATHS.Products }
        ]
    },
    {
        label: 'Adhérents',
        key: 'adherents',
        icon: 'bi-people',
        subMenus: [
            { label: 'répertoire', route: BACK_ROUTE_PATHS.MembersDatabase },
            { label: 'cartes admission', route: BACK_ROUTE_PATHS.GameCardsEditor },
            { label: 'contrôles', route: BACK_ROUTE_PATHS.MemberSales },
        ]
    },
    {
        label: 'Comptabilité',
        key: 'comptabilite',
        icon: 'bi-calculator',
        subMenus: [
            { label: 'état de caisse', route: BACK_ROUTE_PATHS.CashBoxStatus },
            { label: 'chèques', route: BACK_ROUTE_PATHS.Cheques },
            { label: 'rapprochement bancaire', route: BACK_ROUTE_PATHS.BankReconciliation },
            { label: 'écriture', route: BACK_ROUTE_PATHS.BooksEditor },
            { label: 'résultats', route: BACK_ROUTE_PATHS.ExpenseAndRevenue },
            { label: 'bilan', route: BACK_ROUTE_PATHS.Balance },
            { label: 'synthèse', route: BACK_ROUTE_PATHS.BooksOverview }
            // { label: 'factures', route: BACK_ROUTE_PATHS.Invoices },
        ]
    },
    {
        label: 'Stripe',
        key: 'stripe',
        icon: 'bi-credit-card',
        subMenus: [
            { label: 'rapprochement', route: BACK_ROUTE_PATHS.StripeReconciliation },
            { label: 'remboursement', route: BACK_ROUTE_PATHS.StripeRefunds }
        ]
    },
    {
        label: 'Outils',
        key: 'outils',
        icon: 'bi-database-fill-gear',
        subMenus: [
            { label: 'base de données', route: BACK_ROUTE_PATHS.BooksList },
            { label: 'droits d\'accès', route: BACK_ROUTE_PATHS.GroupsList },
            { label: 'configuration', route: BACK_ROUTE_PATHS.SysConf },
            { label: 'backup comptable', route: BACK_ROUTE_PATHS.BookBackup },
        ]
    },

    {
        label: 'Site web',
        key: 'site',
        icon: 'bi-globe2',
        subMenus: [
            { label: 'paramètres UI', route: BACK_ROUTE_PATHS.UiConf },
            { label: 'les menus', route: BACK_ROUTE_PATHS.MenusEditor },
            { label: 'pages et datas', route: BACK_ROUTE_PATHS.CMSWrapper },
            { label: 'utilitaires images', route: BACK_ROUTE_PATHS.ImageMaintenance },
            { label: 'compétitions', route: BACK_ROUTE_PATHS.Competitions },
            { label: 'aller sur le site', route: '/front' }
        ]
    },
    {
        label: 'Communication',
        key: 'communication',
        icon: 'bi-envelope-paper',
        subMenus: [
            { label: 'Assistance', route: BACK_ROUTE_PATHS.Assistance },
            { label: 'Mailing', route: BACK_ROUTE_PATHS.Mailing },
            { label: 'Breaking News', route: BACK_ROUTE_PATHS.BreakingNews },
            { label: 'Sondage', route: BACK_ROUTE_PATHS.SondageList }
        ]
    },
    {
        label: 'Dashboard',
        key: 'dashboard',
        icon: 'bi-speedometer2',
        route: BACK_ROUTE_PATHS.Dashboard
    },
    {
        label: 'DevTools',
        key: 'devtools',
        icon: 'bi-wrench',
        isDev: true,
        subMenus: [
            // { label: 'écritures', route: BACK_ROUTE_PATHS.BooksDebugger },
            { label: 'données S3', route: BACK_ROUTE_PATHS.RootVolume },
            { label: 'import excel', route: BACK_ROUTE_PATHS.ImportExcel },
            { label: 'clone DB', route: BACK_ROUTE_PATHS.CloneDB },
            { label: 'clone S3', route: BACK_ROUTE_PATHS.CloneS3 },
            // { label: 'ComiteeBookletViewer', route: BACK_ROUTE_PATHS.ComiteeBooklet }
        ]
    },
        {
        label: 'Documentation',
        key: 'documentation',
        icon: 'bi-question-circle',
        route: BACK_ROUTE_PATHS.OnlineHelp,
    },
];

function applyRouteAccess(menu: NavbarMenu): NavbarMenu {
    const subMenus = menu.subMenus?.map(applyRouteAccess);
    const routeLevel = menu.route ? getBackRouteMinimumLevel(menu.route) : undefined;
    const childLevels = subMenus
        ?.map((subMenu) => subMenu.minLevel)
        .filter((level): level is number => level !== undefined) ?? [];
    const minLevel = routeLevel ?? (childLevels.length > 0 ? Math.min(...childLevels) : undefined);

    return {
        ...menu,
        minLevel,
        subMenus: subMenus?.map((subMenu) => ({
            ...subMenu,
            minLevel: subMenu.minLevel ?? minLevel,
        })),
    };
}

export const STATIC_MENUS: NavbarMenu[] = MENU_DEFINITIONS.map(applyRouteAccess);