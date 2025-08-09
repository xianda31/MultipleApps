import { Routes } from '@angular/router';
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
import { AdminComponent } from './admin/admin.component';
import { BackPageComponent } from './back-page/back-page.component';
import { SnippetsComponent } from '../common/site/snippets/snippets.component';

export const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      { path: 'caisse/ventes', component: ShopComponent },
      { path: 'caisse/droits-de-table', component: FeesCollectorComponent },
      { path: 'caisse/état-de-caisse', component: CashBoxStatusComponent },
      { path: 'caisse/produits', component: ProductsComponent },

      
      { path: 'members/database', component: MembersComponent },
      { path: 'members/cartes-admission', component: GameCardsEditorComponent },
      { path: 'members/payments', component: MemberSalesComponent },

      
      { path: 'finance/bank-reconciliation', component: BankReconciliationComponent },
      { path: 'finance/expense-and-revenue', component: ExpenseAndRevenueComponent },
      { path: 'finance/toutes-ecritures', component: BooksEditorComponent },
      { path: 'finance/expense-and-revenue/details', component: ExpenseAndRevenueDetailsComponent },
      { path: 'finance/balance', component: BalanceComponent },
      { path: 'finance/books/base-comptable', component: BooksOverviewComponent },
      { path: 'finance/books/base-comptable/:report', component: BooksOverviewComponent },
      
      { path: 'finance/books/list', component: BooksListComponent },
      { path: 'finance/books/editor', component: BooksEditorComponent, data: { access: 'full' } },
      { path: 'finance/books/editor/:id', component: BooksEditorComponent, data: { access: 'full' } },
      
      { path: 'outils/sysconf', component: SysConfComponent },
      { path: 'outils/excel_import', component: ImportExcelComponent },
      { path: 'outils/groups', component: GroupsListComponent },
      { path: 'outils/cloneDB', component: CloneDBComponent },

      { path: 'site/articles', component: SnippetsComponent },

      { path: 'home', component: BackPageComponent },
      { path: '', component: BackPageComponent },
      { path: '**', component: PageNotFoundComponent },
      // { path: '', redirectTo: 'caisse/produits', pathMatch: 'full' },
    ]
  }
];
