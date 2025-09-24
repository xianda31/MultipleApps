import { NgModule } from '@angular/core';
import { CommonModule as AngularCommonModule } from '@angular/common';
import { SharedModule } from './common/shared.module';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { routes } from './back/back.routes';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { AdminComponent } from './back/admin/back.component';
import { SnippetsComponent } from './back/site/snippets/snippets.component';
import { FilemgrWindowsComponent } from './back/files/filemgr/filemgr-windows.component';
import { RootVolumeComponent } from './back/files/root-volume/root-volume';
import { FeesCollectorComponent } from './back/fees/fees-collector/fees-collector.component';
import { MemberSalesComponent } from './back/member-sales/member-sales.component';
import { SysConfComponent } from './back/sys-conf/sys-conf.component';
import { ProductsComponent } from './back/products/products.component';
import { ShopComponent } from './back/shop/shop.component';
import { TodaysBooksComponent } from './back/shop/todays-books/todays-books.component';
import { CartComponent } from './back/shop/cart/cart.component';
import { SnippetModalEditorComponent } from './back/site/snippet-modal-editor/snippet-modal-editor.component';
import { PagesEditorComponent } from './back/pages/pages-editor/pages-editor.component';
import { GetLoggingComponent } from './back/modals/get-logging/get-logging.component';
import { GetConfirmationComponent } from './back/modals/get-confirmation/get-confirmation.component';
import { InputMemberComponent } from './back/input-member/input-member.component';
import { GetEventComponent } from './back/get-event/get-event.component';
import { GroupsListComponent } from './back/groups/groups-list/groups-list.component';
import { ExpenseAndRevenueComponent } from './back/expense-and-revenue/expense-and-revenue.component';
import { BalanceComponent } from './back/balance/balance.component';
import { CloneDBComponent } from './back/maintenance/clone-DB/clone-db.component';
import { BankReconciliationComponent } from './back/bank-reconciliation/bank-reconciliation.component';
import { BooksEditorComponent } from './back/books/books-edit/books-editor.component';
import { BooksOverviewComponent } from './back/books/books-overview/books-overview.component';
import { BooksListComponent } from './back/books/books-list/books-list.component';
import { CashBoxStatusComponent } from './back/books/cash-box-status/cash-box-status.component';
import { ImportExcelComponent } from './back/books/import-excel/import-excel.component';

@NgModule({
  declarations: [
    // aucun pipe ou composant non-standalone
  ],
  imports: [
  AngularCommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    NgbDropdownModule,
    DragDropModule,
    AdminComponent,
    SnippetsComponent,
    FilemgrWindowsComponent,
    RootVolumeComponent,
    FeesCollectorComponent,
    MemberSalesComponent,
    SysConfComponent,
    ProductsComponent,
    ShopComponent,
    TodaysBooksComponent,
    CartComponent,
    SnippetModalEditorComponent,
    PagesEditorComponent,
    GetLoggingComponent,
    GetConfirmationComponent,
    InputMemberComponent,
    GetEventComponent,
    CloneDBComponent,
    GroupsListComponent,
    ExpenseAndRevenueComponent,
    BalanceComponent,
    BankReconciliationComponent,
    BooksEditorComponent,
    BooksOverviewComponent,
    BooksListComponent,
    CashBoxStatusComponent,
    ImportExcelComponent,
  SharedModule
  ],
})
export class BackModule { }
