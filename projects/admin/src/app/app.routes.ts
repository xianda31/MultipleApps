import { Routes } from '@angular/router';
import { ShopComponent } from './shop/shop.component';
import { FeesCollectorComponent } from './fees/fees-collector/fees-collector.component';
import { HomeComponent } from './home/home.component';
import { BooksOverviewComponent } from './books/books-overview/books-overview.component';
import { BooksEditorComponent } from './books/books-edit/books-editor.component';
import { CashBoxStatusComponent } from './books/cash-box-status/cash-box-status.component';
import { BankReconciliationComponent } from './bank-reconciliation/bank-reconciliation.component';
import { BalanceComponent } from './balance/balance.component';
import { ImportExcelComponent } from './excel/import-excel/import-excel.component';
import { BooksListComponent } from './books/books-list/books-list.component';
import { ExpenseAndRevenueComponent } from './expense-and-revenue/expense-and-revenue.component';
import { ExpenseAndRevenueDetailsComponent } from './expense-and-revenue/expense-and-revenue-details/expense-and-revenue-details.component';
import { GameCardsEditorComponent } from './game-cards/game-cards-editor/game-cards-editor.component';
import { BuyComponent } from './buy/buy.component';
import { MembersComponent } from '../../../web-back/src/app/members/members.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';
import { ProductsComponent } from '../../../web-back/src/app/sales/products/products.component';
import { MemberSalesComponent } from './member-sales/member-sales.component';
import { SysConfComponent } from './sys-conf/sys-conf.component';

export const routes: Routes = [
  { path: 'vente/produits', component: ShopComponent },   //, canActivate: [loggedInGuard]
  { path: 'vente/droits-de-table', component: FeesCollectorComponent },

  { path: 'members/database', component: MembersComponent },
  { path: 'members/cartes-admission', component: GameCardsEditorComponent },
  { path: 'members/historique', component: MemberSalesComponent },


  { path: 'admin/toutes-ecritures', component: BuyComponent }, //, canActivate: [loggedInGuard]
  { path: 'admin/produits', component: ProductsComponent }, //, canActivate: [loggedInGuard]
  { path: 'admin/cash-box-status', component: CashBoxStatusComponent },

  { path: 'finance/bank-reconciliation', component: BankReconciliationComponent },
  { path: 'finance/expense-and-revenue', component: ExpenseAndRevenueComponent },
  { path: 'finance/expense-and-revenue/details', component: ExpenseAndRevenueDetailsComponent },
  { path: 'finance/balance', component: BalanceComponent },
  { path: 'finance/books/editor', component: BooksEditorComponent },
  { path: 'finance/books/editor/:id', component: BooksEditorComponent },
  { path: 'finance/books/base-comptable', component: BooksOverviewComponent },
  { path: 'finance/books/base-comptable/:report', component: BooksOverviewComponent },
  
  { path: 'finance/books/list', component: BooksListComponent },
  { path: 'sysconf', component: SysConfComponent },

  { path: 'excel/import', component: ImportExcelComponent },
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  // {
  //     path: 'authentification',
  //     loadChildren: () => import('../../../common/authentification/authentification.module').then(m => m.AuthentificationModule),
  // },
  // { path: 'test', component: TestComponent },
  { path: '**', component: PageNotFoundComponent },
];
