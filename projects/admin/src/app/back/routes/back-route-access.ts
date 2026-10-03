import { Group_names, Group_priorities } from '../../common/authentification/group.interface';
import { BACK_ROUTE_PATHS } from './back-route-paths';

export type BackRouteKey = keyof typeof BACK_ROUTE_PATHS;

export interface BackRouteAccess {
  minimumGroup: Group_names;
  helpTopicId?: string;
}

export const BACK_ROUTE_ACCESS = {
  Shop: { minimumGroup: Group_names.Support, helpTopicId: 'boutique-vente-adherent' },
  FeesCollector: { minimumGroup: Group_names.Support, helpTopicId: 'tournois-droits-table' },
  Products: { minimumGroup: Group_names.Support, helpTopicId: 'boutique-produits' },
  Billetterie: { minimumGroup: Group_names.Support, helpTopicId: 'boutique-billetterie' },
  MembersDatabase: { minimumGroup: Group_names.Support, helpTopicId: 'adherents-repertoire' },
  GameCardsEditor: { minimumGroup: Group_names.Admin, helpTopicId: 'adherents-cartes' },
  MemberSales: { minimumGroup: Group_names.Support, helpTopicId: 'adherents-controles' },
  CashBoxStatus: { minimumGroup: Group_names.Admin, helpTopicId: 'compta-etat-caisse' },
  Cheques: { minimumGroup: Group_names.Admin, helpTopicId: 'compta-cheques' },
  BankReconciliation: { minimumGroup: Group_names.Admin, helpTopicId: 'compta-rapprochement' },
  ExpenseAndRevenue: { minimumGroup: Group_names.Admin, helpTopicId: 'compta-resultats' },
  ExpenseAndRevenueDetails: { minimumGroup: Group_names.Admin, helpTopicId: 'compta-resultats' },
  Balance: { minimumGroup: Group_names.Admin, helpTopicId: 'compta-bilan' },
  BooksOverview: { minimumGroup: Group_names.Admin, helpTopicId: 'compta-synthese' },
  BooksOverviewReport: { minimumGroup: Group_names.Admin, helpTopicId: 'compta-synthese' },
  BooksList: { minimumGroup: Group_names.System, helpTopicId: 'outils-base-donnees' },
  BooksEditor: { minimumGroup: Group_names.Admin, helpTopicId: 'compta-ecriture' },
  BooksEditorId: { minimumGroup: Group_names.Admin, helpTopicId: 'compta-ecriture' },
  SysConf: { minimumGroup: Group_names.System, helpTopicId: 'outils-configuration' },
  ImportExcel: { minimumGroup: Group_names.System, helpTopicId: 'devtools-import-excel' },
  GroupsList: { minimumGroup: Group_names.System, helpTopicId: 'outils-droits-acces' },
  CloneDB: { minimumGroup: Group_names.System, helpTopicId: 'devtools-clone-db' },
  CloneS3: { minimumGroup: Group_names.System, helpTopicId: 'devtools-clone-s3' },
  BookBackup: { minimumGroup: Group_names.System, helpTopicId: 'outils-backup' },
  Dashboard: { minimumGroup: Group_names.Support, helpTopicId: 'dashboard-suivi' },
  StripeReconciliation: { minimumGroup: Group_names.Admin, helpTopicId: 'stripe-rapprochement' },
  StripeRefunds: { minimumGroup: Group_names.Admin, helpTopicId: 'stripe-remboursement' },
  RootVolume: { minimumGroup: Group_names.System, helpTopicId: 'devtools-donnees-s3' },
  FilemgrWindows: { minimumGroup: Group_names.System, helpTopicId: 'devtools-donnees-s3' },
  UiConf: { minimumGroup: Group_names.Editor, helpTopicId: 'site-parametres-ui' },
  MenusEditor: { minimumGroup: Group_names.Editor, helpTopicId: 'site-menus' },
  CMSWrapper: { minimumGroup: Group_names.Editor, helpTopicId: 'site-pages-datas' },
  ImageMaintenance: { minimumGroup: Group_names.Editor, helpTopicId: 'site-images' },
  Competitions: { minimumGroup: Group_names.Editor, helpTopicId: 'site-competitions' },
  Home: { minimumGroup: Group_names.Member, helpTopicId: undefined },
  OnlineHelp: { minimumGroup: Group_names.Member, helpTopicId: 'documentation' },
  Assistance: { minimumGroup: Group_names.Editor, helpTopicId: 'communication-assistance' },
  Mailing: { minimumGroup: Group_names.Editor, helpTopicId: 'communication-mailing' },
  BreakingNews: { minimumGroup: Group_names.Editor, helpTopicId: 'communication-breaking-news' },
  SondageList: { minimumGroup: Group_names.Editor, helpTopicId: 'communication-sondage' },
  SondageEditor: { minimumGroup: Group_names.Editor, helpTopicId: 'communication-sondage' },
  SondageResultats: { minimumGroup: Group_names.Editor, helpTopicId: 'communication-sondage' },
  SignOut: { minimumGroup: Group_names.Member, helpTopicId: undefined },
} satisfies Record<BackRouteKey, BackRouteAccess>;

const BACK_ROUTE_ALIASES: Record<string, BackRouteKey> = {
  'caisse/collecte': 'Billetterie',
  [`${BACK_ROUTE_PATHS.Shop}/:member_id`]: 'Shop',
};

export function getBackRouteAccess(path: string): BackRouteAccess | undefined {
  const normalizedPath = path.replace(/^\/back\//, '');
  const aliasKey = BACK_ROUTE_ALIASES[normalizedPath];
  if (aliasKey) return BACK_ROUTE_ACCESS[aliasKey];

  const routeKey = (Object.keys(BACK_ROUTE_PATHS) as BackRouteKey[])
    .find((key) => BACK_ROUTE_PATHS[key] === normalizedPath);
  return routeKey ? BACK_ROUTE_ACCESS[routeKey] : undefined;
}

export function getBackRouteMinimumLevel(path: string): number | undefined {
  const access = getBackRouteAccess(path);
  return access ? Group_priorities[access.minimumGroup] : undefined;
}