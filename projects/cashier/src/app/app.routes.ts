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

export const routes: Routes = [
  { path: 'shop', component: ShopComponent },   //, canActivate: [loggedInGuard]
  {path: 'buy', component: BuyComponent}, //, canActivate: [loggedInGuard]
  { path: 'books/overview', component: BooksOverviewComponent },
  { path: 'books/overview/:report', component: BooksOverviewComponent },
  { path: 'books/editor', component: BooksEditorComponent },
  { path: 'books/list', component: BooksListComponent },
  { path: 'books/editor/:id', component: BooksEditorComponent },
  { path: 'books/cash-box-status', component: CashBoxStatusComponent },
  { path: 'tournois/droits-de-table', component: FeesCollectorComponent },
  { path: 'tournois/cartes-admission', component: GameCardsEditorComponent },
  { path: 'excel/import', component: ImportExcelComponent },
  { path: 'bank-reconciliation', component: BankReconciliationComponent },
  { path: 'balance', component: BalanceComponent },
  { path: 'expense-and-revenue', component: ExpenseAndRevenueComponent },
  { path: 'expense-and-revenue/details', component: ExpenseAndRevenueDetailsComponent },
  { path: '', component: HomeComponent },
  // {
  //     path: 'authentification',
  //     loadChildren: () => import('../../../common/authentification/authentification.module').then(m => m.AuthentificationModule),
  // },
  // { path: 'test', component: TestComponent },
  { path: '**', redirectTo: '' },
];
