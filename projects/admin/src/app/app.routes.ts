import { Routes } from '@angular/router';
import { EntryRedirectComponent } from './entry-redirect.component';

export const routes: Routes = [
  { path: '', component: EntryRedirectComponent },
  { path: 'front', loadChildren: () => import('./front.module').then(m => m.FrontModule) },
  { path: 'back', loadChildren: () => import('./back/back.routes').then(m => m.routes) },
  { path: '**', redirectTo: 'front' },
];
