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
import { MembersComponent } from '../../../admin-dashboard/src/app/members/members.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';

export const routes: Routes = [
  { path: 'boutique/articles', component: ShopComponent },   //, canActivate: [loggedInGuard]
  { path: 'boutique/droits-de-table', component: FeesCollectorComponent },

  { path: 'adhérents', component: MembersComponent },

  { path: 'compta/cartes-admission', component: GameCardsEditorComponent },
  { path: 'compta/toutes-ecritures', component: BuyComponent }, //, canActivate: [loggedInGuard]
  { path: 'compta/cash-box-status', component: CashBoxStatusComponent },

  { path: 'finance/bank-reconciliation', component: BankReconciliationComponent },
  { path: 'finance/expense-and-revenue', component: ExpenseAndRevenueComponent },
  { path: 'finance/expense-and-revenue/details', component: ExpenseAndRevenueDetailsComponent },
  { path: 'finance/balance', component: BalanceComponent },
  { path: 'finance/books/editor', component: BooksEditorComponent },
  { path: 'finance/books/editor/:id', component: BooksEditorComponent },
  { path: 'finance/books/base-comptable', component: BooksOverviewComponent },
  { path: 'finance/books/base-comptable/:report', component: BooksOverviewComponent },
  { path: 'finance/books/list', component: BooksListComponent },

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
