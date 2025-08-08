import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MembersComponent } from './common/members/members.component';
import { BalanceComponent } from './back/balance/balance.component';
import { BankReconciliationComponent } from './back/bank-reconciliation/bank-reconciliation.component';
import { BooksEditorComponent } from './back/books/books-edit/books-editor.component';
import { BooksListComponent } from './back/books/books-list/books-list.component';
import { BooksOverviewComponent } from './back/books/books-overview/books-overview.component';
import { CashBoxStatusComponent } from './back/books/cash-box-status/cash-box-status.component';
import { ImportExcelComponent } from './back/books/import-excel/import-excel.component';
import { ExpenseAndRevenueDetailsComponent } from './back/expense-and-revenue/expense-and-revenue-details/expense-and-revenue-details.component';
import { ExpenseAndRevenueComponent } from './back/expense-and-revenue/expense-and-revenue.component';
import { FeesCollectorComponent } from './back/fees/fees-collector/fees-collector.component';
import { GameCardsEditorComponent } from './back/game-cards/game-cards-editor/game-cards-editor.component';
import { GroupsListComponent } from './back/groups/groups-list/groups-list.component';
import { CloneDBComponent } from './back/maintenance/clone-DB/clone-db.component';
import { MemberSalesComponent } from './back/member-sales/member-sales.component';
import { PageNotFoundComponent } from './common/page-not-found/page-not-found.component';
import { ProductsComponent } from './back/products/products.component';
import { ShopComponent } from './back/shop/shop.component';
import { SysConfComponent } from './back/sys-conf/sys-conf.component';
import { routes } from './back/back.routes';
import { AdminComponent } from './back/admin/admin.component';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';



@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    NgbDropdownModule,
    AdminComponent,
    ShopComponent,
    FeesCollectorComponent,
    CashBoxStatusComponent,
    MembersComponent,
    GameCardsEditorComponent,
    MemberSalesComponent,
    BankReconciliationComponent,
    ExpenseAndRevenueComponent,
    ExpenseAndRevenueDetailsComponent,
    BooksOverviewComponent,
    BooksEditorComponent,
    BooksListComponent,
    BalanceComponent,
    GroupsListComponent,
    ProductsComponent,
    SysConfComponent,
    ImportExcelComponent,
    PageNotFoundComponent,
    CloneDBComponent
  ],
  exports: [
    RouterModule,
    NgbDropdownModule,
    AdminComponent
    // Export components if needed
  ],
})
export class BackModule { }
