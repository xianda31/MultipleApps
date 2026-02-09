import { Group_priorities } from "../../common/authentification/group.interface";
import { BACK_ROUTE_PATHS } from "../routes/back-route-paths";

export
    interface NavbarMenu {
    label: string;
    key?: string;
    icon?: string;
    route?: string;
    minLevel?: number;
    adminOnly?: boolean;
    subMenus?: NavbarMenu[];
    isDev?: boolean;
    isSystem?: boolean;
    isUser?: boolean;
}

export const STATIC_MENUS: NavbarMenu[] = [
    {
        label: 'Tournois',
        key: 'boutique',
        icon: 'bi-card-checklist',
        route: BACK_ROUTE_PATHS.FeesCollector,
        minLevel: Group_priorities.Contributeur
    },
    {
        label: 'Boutique',
        key: 'boutique',
        icon: 'bi-cart',
        minLevel: Group_priorities.Contributeur,
        subMenus: [
            { label: 'vente à adhérents', route: BACK_ROUTE_PATHS.Shop },
            { label: 'produits à la vente', route: BACK_ROUTE_PATHS.Products }
        ]
    },
    {
        label: 'Adhérents',
        key: 'adherents',
        icon: 'bi-people',
        minLevel: Group_priorities.Contributeur,
        subMenus: [
            { label: 'répertoire', route: BACK_ROUTE_PATHS.MembersDatabase },
            { label: 'cartes admission', route: BACK_ROUTE_PATHS.GameCardsEditor, adminOnly: true },
            { label: 'contrôles', route: BACK_ROUTE_PATHS.MemberSales },
        ]
    },
    {
        label: 'Finance',
        key: 'finance',
        icon: 'bi-journal',
        minLevel: Group_priorities.Administrateur,
        subMenus: [
            { label: 'état de caisse', route: BACK_ROUTE_PATHS.CashBoxStatus },
            { label: 'écritures', route: BACK_ROUTE_PATHS.BooksEditor },
            { label: 'synthèse', route: BACK_ROUTE_PATHS.BooksOverview },
            { label: 'rapprochement bancaire', route: BACK_ROUTE_PATHS.BankReconciliation },
            { label: 'résultats', route: BACK_ROUTE_PATHS.ExpenseAndRevenue },
            { label: 'bilan', route: BACK_ROUTE_PATHS.Balance }
        ]
    },
    {
        label: 'Outils',
        key: 'outils',
        icon: 'bi-database-fill-gear',
        minLevel: Group_priorities.Systeme,
        subMenus: [
            { label: 'base de données', route: BACK_ROUTE_PATHS.BooksList },
            { label: 'droits d\'accès', route: BACK_ROUTE_PATHS.GroupsList },
            { label: 'configuration', route: BACK_ROUTE_PATHS.SysConf },
            // { label: 'écriture', route: BACK_ROUTE_PATHS.BooksEditor }
        ]
    },

    {
        label: 'Site web',
        key: 'site',
        icon: 'bi-globe2',
        minLevel: Group_priorities.Administrateur,
        subMenus: [
            { label: 'paramètres UI', route: BACK_ROUTE_PATHS.UiConf },
            { label: 'les menus', route: BACK_ROUTE_PATHS.MenusEditor },
            { label: 'pages et datas', route: BACK_ROUTE_PATHS.CMSWrapper },
            { label: 'compétitions', route: BACK_ROUTE_PATHS.Competitions },
            { label: 'aller sur le site', route: '/front' }
        ]
    },
    {
        label: 'Communication',
        key: 'communication',
        icon: 'bi-envelope-paper',
        minLevel: Group_priorities.Administrateur,
        subMenus: [
            { label: 'Assistance', route: BACK_ROUTE_PATHS.Assistance },
            { label: 'Mailing', route: BACK_ROUTE_PATHS.Mailing }
        ]
    },
    {
        label: 'DevTools',
        key: 'devtools',
        icon: 'bi-wrench',
        minLevel: Group_priorities.Systeme,
        isDev: true,
        subMenus: [
            // { label: 'écritures', route: BACK_ROUTE_PATHS.BooksDebugger },
            { label: 'données S3', route: BACK_ROUTE_PATHS.RootVolume },
            { label: 'import excel', route: BACK_ROUTE_PATHS.ImportExcel },
            { label: 'clone DB', route: BACK_ROUTE_PATHS.CloneDB },
            { label: 'clone S3', route: BACK_ROUTE_PATHS.CloneS3 },
            { label: 'ComiteeBookletViewer', route: BACK_ROUTE_PATHS.ComiteeBooklet }
        ]
    },
]
