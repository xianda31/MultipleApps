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

export const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [

  { path: BACK_ROUTE_PATHS.Shop, component: ShopComponent },
  { path: BACK_ROUTE_PATHS.FeesCollector, component: FeesCollectorComponent },
  { path: BACK_ROUTE_PATHS.Products, component: ProductsComponent },
      
      
  { path: BACK_ROUTE_PATHS.MembersDatabase, component: MembersComponent },
  { path: BACK_ROUTE_PATHS.GameCardsEditor, component: GameCardsEditorComponent },
  { path: BACK_ROUTE_PATHS.MemberSales, component: MemberSalesComponent },
      
      
  { path: BACK_ROUTE_PATHS.CashBoxStatus, component: CashBoxStatusComponent },
  { path: BACK_ROUTE_PATHS.BankReconciliation, component: BankReconciliationComponent },
  { path: BACK_ROUTE_PATHS.ExpenseAndRevenue, component: ExpenseAndRevenueComponent },
  { path: BACK_ROUTE_PATHS.BooksEditor, component: BooksEditorComponent },
  { path: BACK_ROUTE_PATHS.ExpenseAndRevenueDetails, component: ExpenseAndRevenueDetailsComponent },
  { path: BACK_ROUTE_PATHS.Balance, component: BalanceComponent },
  { path: BACK_ROUTE_PATHS.BooksOverview, component: BooksOverviewComponent },
  { path: BACK_ROUTE_PATHS.BooksOverviewReport, component: BooksOverviewComponent },
      
  { path: BACK_ROUTE_PATHS.BooksList, component: BooksListComponent },
  { path: BACK_ROUTE_PATHS.BooksEditorFull, component: BooksEditorComponent, data: { access: 'full' } },
  { path: BACK_ROUTE_PATHS.BooksEditorFullId, component: BooksEditorComponent, data: { access: 'full' } },
      
  { path: BACK_ROUTE_PATHS.SysConf, component: SysConfComponent },
  { path: BACK_ROUTE_PATHS.ImportExcel, component: ImportExcelComponent },
  { path: BACK_ROUTE_PATHS.GroupsList, component: GroupsListComponent },
  { path: BACK_ROUTE_PATHS.CloneDB, component: CloneDBComponent },

  { path: BACK_ROUTE_PATHS.Snippets, component: SnippetsComponent },
  { path: BACK_ROUTE_PATHS.RootVolume, component: RootVolumeComponent },
  { path: BACK_ROUTE_PATHS.FilemgrWindows, component: FilemgrWindowsComponent },
  { path: BACK_ROUTE_PATHS.PagesEditor, component: PagesEditorComponent },
  { path: BACK_ROUTE_PATHS.Home, component: BackPageComponent },


      { path: '', component: BackPageComponent },
      { path: '**', component: PageNotFoundComponent },
      // { path: '', redirectTo: 'caisse/produits', pathMatch: 'full' },
    ]
  }
];
