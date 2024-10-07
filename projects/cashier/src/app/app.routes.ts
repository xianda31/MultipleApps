import { Routes } from '@angular/router';
import { SalesComponent } from './sales//sales/sales.component'; // Adjust the import path as necessary
import { FeesComponent } from './fees/fees/fees.component';
import { BooksComponent } from './sales/books/books.component';
import { TestComponent } from './test/test.component';
import { AdminInComponent } from './admin-in/admin-in.component';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
    { path: 'sales', component: SalesComponent },
    { path: 'books', component: BooksComponent },
    { path: 'fees', component: FeesComponent },
    { path: '', component: HomeComponent },
    // {
    //     path: 'authentification',
    //     loadChildren: () => import('../../../common/authentification/authentification.module').then(m => m.AuthentificationModule),
    // },
    // { path: 'test', component: TestComponent },
    { path: '*', redirectTo: '', pathMatch: 'full' },
];
