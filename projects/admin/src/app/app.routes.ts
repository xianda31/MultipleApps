import { Routes } from '@angular/router';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';

export const routes: Routes = [
  {
      path: 'admin',
      loadChildren: () => import('../app/modules/admin.module').then(m => m.AdminModule),
  },
  { path: '**', component: PageNotFoundComponent },
];
