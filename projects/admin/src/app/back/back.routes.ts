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
import { FilemgrWindowsComponent } from './files/filemgr/filemgr-windows.component';
import { RootVolumeComponent } from './files/root-volume/root-volume';
import { AuthGuard } from '../auth.guard';
import { MenusEditorComponent } from './menus/menus-editor/menus-editor';
import { UiConfComponent } from './ui-conf/ui-conf.component';
import { CloneS3Component } from './maintenance/clone-S3/clone-s3.component';
import { BackAssistanceComponent } from './back-assistance/back-assistance.component';
import { MailingComponent } from './mailing/mailing.component';
import { CmsWrapper } from './pages/cms-wrapper/cms-wrapper';
import { CompetitionsComponent } from './competitions/competitions';
import { PdfViewerComponent } from './pdf-viewer/pdf-viewer.component';

export const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [

      { path: BACK_ROUTE_PATHS.Shop, component: ShopComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.FeesCollector, component: FeesCollectorComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.Products, component: ProductsComponent, canActivate: [AuthGuard] },


      { path: BACK_ROUTE_PATHS.MembersDatabase, component: MembersComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.GameCardsEditor, component: GameCardsEditorComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.MemberSales, component: MemberSalesComponent, canActivate: [AuthGuard] },


      { path: BACK_ROUTE_PATHS.CashBoxStatus, component: CashBoxStatusComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.BankReconciliation, component: BankReconciliationComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.ExpenseAndRevenue, component: ExpenseAndRevenueComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.BooksEditor, component: BooksEditorComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.ExpenseAndRevenueDetails, component: ExpenseAndRevenueDetailsComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.Balance, component: BalanceComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.BooksOverview, component: BooksOverviewComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.BooksOverviewReport, component: BooksOverviewComponent, canActivate: [AuthGuard] },

      { path: BACK_ROUTE_PATHS.BooksList, component: BooksListComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.BooksEditor, component: BooksEditorComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.BooksEditorId, component: BooksEditorComponent, canActivate: [AuthGuard] },

      { path: BACK_ROUTE_PATHS.SysConf, component: SysConfComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.ImportExcel, component: ImportExcelComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.GroupsList, component: GroupsListComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.RootVolume, component: RootVolumeComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.FilemgrWindows, component: FilemgrWindowsComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.CloneDB, component: CloneDBComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.CloneS3, component: CloneS3Component, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.ComiteeBooklet, component: PdfViewerComponent, data:{pdf_src:'Agenda_2025_26.pdf'}, canActivate: [AuthGuard] },
      // { path: BACK_ROUTE_PATHS.BooksDebugger, component: BooksEditorComponent, data: { access: 'full' }, canActivate: [AuthGuard] },
      // { path: BACK_ROUTE_PATHS.BooksDebuggerId, component: BooksEditorComponent, data: { access: 'full' }, canActivate: [AuthGuard] },


      // { path: BACK_ROUTE_PATHS.Snippets, component: SnippetsComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.UiConf, component: UiConfComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.MenusEditor, component: MenusEditorComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.CMSWrapper, component: CmsWrapper, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.Home, component: BackPageComponent },
      { path: BACK_ROUTE_PATHS.SignOut, component: BackPageComponent },
      { path: BACK_ROUTE_PATHS.Assistance, component: BackAssistanceComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.Mailing, component: MailingComponent, canActivate: [AuthGuard] },
      { path: BACK_ROUTE_PATHS.Competitions, component: CompetitionsComponent, data: { access: 'full' }, canActivate: [AuthGuard] },



      { path: '', component: BackPageComponent },
      { path: '**', component: PageNotFoundComponent },
      // { path: '', redirectTo: 'caisse/produits', pathMatch: 'full' },
    ]
  }
];
