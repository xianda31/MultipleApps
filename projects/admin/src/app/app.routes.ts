import { Routes } from '@angular/router';
import { PageNotFoundComponent } from './common/page-not-found/page-not-found.component';

export const routes: Routes = [
  { path: 'admin', loadChildren: () => import('./back/back.module').then(m => m.AdminModule) },
  { path: 'front', loadChildren: () => import('./front/front.module').then(m => m.FrontModule) },
  { path: '**', component: PageNotFoundComponent },
];
