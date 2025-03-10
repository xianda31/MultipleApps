import { Routes } from '@angular/router';
import { ShopComponent } from './shop/shop.component';
import { FeesCollectorComponent } from './fees/fees-collector/fees-collector.component';
import { HomeComponent } from './home/home.component';
import { BooksOverviewComponent } from './books/books-overview/books-overview.component';
import { BooksEditorComponent } from './books/books-edit/books-editor.component';
import { CashBoxStatusComponent } from './books/cash-box-status/cash-box-status.component';
import { FeesEditorComponent } from './fees/fees-editor/fees-editor.component';
import { BankReconciliationComponent } from './bank-reconciliation/bank-reconciliation.component';
import { BalanceComponent } from './balance/balance.component';
import { ProfitAndLossComponent } from './profit-and-loss/profit-and-loss.component';

export const routes: Routes = [
    { path: 'shop', component: ShopComponent },   //, canActivate: [loggedInGuard]
    { path: 'books/overview', component: BooksOverviewComponent },
    { path: 'books/editor', component: BooksEditorComponent },
    { path: 'books/editor/:id', component: BooksEditorComponent },
    { path: 'books/cash-box-status', component: CashBoxStatusComponent },
    { path: 'fees/collector', component: FeesCollectorComponent },
    { path: 'fees/editor', component: FeesEditorComponent },
    // { path: 'excel/import', component: ImportExcelComponent },
    { path: 'bank-reconciliation', component: BankReconciliationComponent },
    { path: 'balance-sheet', component: BalanceComponent },
    { path: 'profit-and-loss', component: ProfitAndLossComponent },
    { path: '', component: HomeComponent },
    // {
    //     path: 'authentification',
    //     loadChildren: () => import('../../../common/authentification/authentification.module').then(m => m.AuthentificationModule),
    // },
    // { path: 'test', component: TestComponent },
    { path: '**', redirectTo: '' },
];
