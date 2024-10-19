import { Routes } from '@angular/router';
import { ShopComponent } from './shop/shop.component';
import { FeesComponent } from './fees/fees/fees.component';
import { HomeComponent } from './home/home.component';
import { SalesComponent } from './books/sales/sales.component';

export const routes: Routes = [
    { path: 'sales', component: ShopComponent },   //, canActivate: [loggedInGuard]
    { path: 'books/sales', component: SalesComponent },
    { path: 'fees', component: FeesComponent },
    { path: '', component: HomeComponent },
    // {
    //     path: 'authentification',
    //     loadChildren: () => import('../../../common/authentification/authentification.module').then(m => m.AuthentificationModule),
    // },
    // { path: 'test', component: TestComponent },
    { path: '*', redirectTo: '', pathMatch: 'full' },
];
