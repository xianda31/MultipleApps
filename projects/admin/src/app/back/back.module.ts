import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MembersComponent } from '../common/members/members.component';
import { BalanceComponent } from './balance/balance.component';
import { BankReconciliationComponent } from './bank-reconciliation/bank-reconciliation.component';
import { BooksEditorComponent } from './books/books-edit/books-editor.component';
import { BooksListComponent } from './books/books-list/books-list.component';
import { BooksOverviewComponent } from './books/books-overview/books-overview.component';
import { CashBoxStatusComponent } from './books/cash-box-status/cash-box-status.component';
import { ImportExcelComponent } from './excel/import-excel/import-excel.component';
import { ExpenseAndRevenueDetailsComponent } from './expense-and-revenue/expense-and-revenue-details/expense-and-revenue-details.component';
import { ExpenseAndRevenueComponent } from './expense-and-revenue/expense-and-revenue.component';
import { FeesCollectorComponent } from './fees/fees-collector/fees-collector.component';
import { GameCardsEditorComponent } from './game-cards/game-cards-editor/game-cards-editor.component';
import { GroupsListComponent } from './groups/groups-list/groups-list.component';
import { HomeComponent } from './home/home.component';
import { CloneDBComponent } from './maintenance/clone-DB/clone-db.component';
import { MemberSalesComponent } from './member-sales/member-sales.component';
import { PageNotFoundComponent } from '../common/page-not-found/page-not-found.component';
import { ProductsComponent } from './products/products.component';
import { ShopComponent } from './shop/shop.component';
import { SysConfComponent } from './sys-conf/sys-conf.component';
import { routes } from './back.routes';
import { AdminComponent } from './admin/admin.component';



@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
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
    HomeComponent,
    PageNotFoundComponent,
    CloneDBComponent
  ],
  exports: [
    RouterModule,
    AdminComponent
    // Export components if needed
  ],
})
export class AdminModule { }
