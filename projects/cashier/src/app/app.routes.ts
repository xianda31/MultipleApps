import { Routes } from '@angular/router';
import { ShopComponent } from './shop/shop.component';
import { FeesComponent } from './fees/fees/fees.component';
import { HomeComponent } from './home/home.component';
import { BooksOverviewComponent } from './books/books-overview/books-overview.component';
import { ImportExcelComponent } from './excel/import-excel/import-excel.component';
import { BooksEditorComponent } from './books/books-edit/books-editor.component';
import { CashBoxStatusComponent } from './books/cash-box-status/cash-box-status.component';

export const routes: Routes = [
    { path: 'shop', component: ShopComponent },   //, canActivate: [loggedInGuard]
    { path: 'books/overview', component: BooksOverviewComponent },
    { path: 'books/editor', component: BooksEditorComponent },
    { path: 'books/editor/:id', component: BooksEditorComponent },
    { path: 'books/cash-box-status', component: CashBoxStatusComponent },
    { path: 'fees', component: FeesComponent },
    { path: 'excel/import', component: ImportExcelComponent },
    { path: '', component: HomeComponent },
    // {
    //     path: 'authentification',
    //     loadChildren: () => import('../../../common/authentification/authentification.module').then(m => m.AuthentificationModule),
    // },
    // { path: 'test', component: TestComponent },
    { path: '**', redirectTo: '' },
];
