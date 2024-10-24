import { Routes } from '@angular/router';
import { ShopComponent } from './shop/shop.component';
import { FeesComponent } from './fees/fees/fees.component';
import { HomeComponent } from './home/home.component';
import { CustomersComponent } from './books/customers/customers.component';
import { RevenuesComponent } from './revenues/revenues.component';

export const routes: Routes = [
    { path: 'sales', component: ShopComponent },   //, canActivate: [loggedInGuard]
    { path: 'books/revenues', component: RevenuesComponent },
    { path: 'books/customers', component: CustomersComponent },
    { path: 'fees', component: FeesComponent },
    { path: '', component: HomeComponent },
    // {
    //     path: 'authentification',
    //     loadChildren: () => import('../../../common/authentification/authentification.module').then(m => m.AuthentificationModule),
    // },
    // { path: 'test', component: TestComponent },
    { path: '**', redirectTo: '' },
];
