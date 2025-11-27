import { Routes } from '@angular/router';
import { BACK_ROUTE_PATHS } from './routes/back-route-paths';
import { ShopComponent } from './shop/shop.component';
import { FeesCollectorComponent } from './fees/fees-collector/fees-collector.component';
import { BooksOverviewComponent } from './books/books-overview/books-overview.component';
import { BooksEditorComponent } from './books/books-edit/books-editor.component';
import { CashBoxStatusComponent } from './books/cash-box-status/cash-box-status.component';
import { BankReconciliationComponent } from './bank-reconciliation/bank-reconciliation.component';
import { BalanceComponent } from './balance/balance.component';
import { ImportExcelComponent } from './books/import-excel/import-excel.component';
import { BooksListComponent } from './books/books-list/books-list.component';
import { ExpenseAndRevenueComponent } from './expense-and-revenue/expense-and-revenue.component';
import { ExpenseAndRevenueDetailsComponent } from './expense-and-revenue/expense-and-revenue-details/expense-and-revenue-details.component';
import { GameCardsEditorComponent } from './game-cards/game-cards-editor/game-cards-editor.component';
import { PageNotFoundComponent } from '../common/page-not-found/page-not-found.component';
import { MemberSalesComponent } from './member-sales/member-sales.component';
import { SysConfComponent } from './sys-conf/sys-conf.component';
import { GroupsListComponent } from './groups/groups-list/groups-list.component';
import { ProductsComponent } from './products/products.component';
import { MembersComponent } from '../common/members/members.component';
import { CloneDBComponent } from './maintenance/clone-DB/clone-db.component';
import { AdminComponent } from './admin/back.component';
import { BackPageComponent } from './back-page/back-page.component';
import { SnippetsComponent } from './site/snippets/snippets.component';
import { PagesEditorComponent } from './pages/pages-editor/pages-editor.component';
import { FilemgrWindowsComponent } from './files/filemgr/filemgr-windows.component';
import { RootVolumeComponent } from './files/root-volume/root-volume';
import { BackAuthGuard } from '../back-auth.guard';
import { MenusEditorComponent } from './menus/menus-editor/menus-editor';
import { UiConfComponent } from './ui-conf/ui-conf.component';
import { CloneS3Component } from './maintenance/clone-S3/clone-s3.component';
import { AssistanceComponent } from '../front/front/assistance/assistance.component';
import { BackAssistanceComponent } from './back-assistance/back-assistance.component';

export const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [

  { path: BACK_ROUTE_PATHS.Shop, component: ShopComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.FeesCollector, component: FeesCollectorComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.Products, component: ProductsComponent, canActivate: [BackAuthGuard] },
      
      
  { path: BACK_ROUTE_PATHS.MembersDatabase, component: MembersComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.GameCardsEditor, component: GameCardsEditorComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.MemberSales, component: MemberSalesComponent, canActivate: [BackAuthGuard] },
      
      
  { path: BACK_ROUTE_PATHS.CashBoxStatus, component: CashBoxStatusComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.BankReconciliation, component: BankReconciliationComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.ExpenseAndRevenue, component: ExpenseAndRevenueComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.BooksEditor, component: BooksEditorComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.ExpenseAndRevenueDetails, component: ExpenseAndRevenueDetailsComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.Balance, component: BalanceComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.BooksOverview, component: BooksOverviewComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.BooksOverviewReport, component: BooksOverviewComponent, canActivate: [BackAuthGuard] },
      
  { path: BACK_ROUTE_PATHS.BooksList, component: BooksListComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.BooksEditorFull, component: BooksEditorComponent, data: { access: 'full' }, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.BooksEditorFullId, component: BooksEditorComponent, data: { access: 'full' }, canActivate: [BackAuthGuard] },
      
  { path: BACK_ROUTE_PATHS.SysConf, component: SysConfComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.ImportExcel, component: ImportExcelComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.GroupsList, component: GroupsListComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.CloneDB, component: CloneDBComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.CloneS3, component: CloneS3Component, canActivate: [BackAuthGuard] },

  { path: BACK_ROUTE_PATHS.Snippets, component: SnippetsComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.UiConf, component: UiConfComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.RootVolume, component: RootVolumeComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.FilemgrWindows, component: FilemgrWindowsComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.MenusEditor, component: MenusEditorComponent },
  { path: BACK_ROUTE_PATHS.PagesEditor, component: PagesEditorComponent, canActivate: [BackAuthGuard] },
  { path: BACK_ROUTE_PATHS.Home, component: BackPageComponent },
  { path: BACK_ROUTE_PATHS.Assistance, component: BackAssistanceComponent, canActivate: [BackAuthGuard] },


      { path: '', component: BackPageComponent },
      { path: '**', component: PageNotFoundComponent },
      // { path: '', redirectTo: 'caisse/produits', pathMatch: 'full' },
    ]
  }
];
