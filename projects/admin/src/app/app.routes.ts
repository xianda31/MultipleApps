import { Routes } from '@angular/router';
import { PageNotFoundComponent } from './common/page-not-found/page-not-found.component';

export const routes: Routes = [
  { path: 'admin', loadChildren: () => import('./back.module').then(m => m.BackModule) },
  // { path: 'front', component: FrontComponent },
  { path: 'front', loadChildren: () => import('./front.module').then(m => m.FrontModule) },
  { path: '**', component: PageNotFoundComponent },
];
