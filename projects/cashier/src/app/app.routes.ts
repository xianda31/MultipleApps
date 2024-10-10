import { Routes } from '@angular/router';
import { SalesComponent } from './sales//sales/sales.component'; // Adjust the import path as necessary
import { FeesComponent } from './fees/fees/fees.component';
import { HomeComponent } from './home/home.component';
import { RevenuesComponent } from './books/revenues/revenues.component';

export const routes: Routes = [
    { path: 'sales', component: SalesComponent },   //, canActivate: [loggedInGuard]
    { path: 'books/revenues', component: RevenuesComponent },
    { path: 'fees', component: FeesComponent },
    { path: '', component: HomeComponent },
    // {
    //     path: 'authentification',
    //     loadChildren: () => import('../../../common/authentification/authentification.module').then(m => m.AuthentificationModule),
    // },
    // { path: 'test', component: TestComponent },
    { path: '*', redirectTo: '', pathMatch: 'full' },
];
