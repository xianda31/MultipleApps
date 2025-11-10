import { Routes } from '@angular/router';
import { AppComponent } from './app.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'front' },
  // Front still lazy via its minimal module (dynamic routes provider)
  { path: 'front', loadChildren: () => import('./front.module').then(m => m.FrontModule) },
  // Back lazy-loaded via direct routes array from back.routes
  { path: 'back', loadChildren: () => import('./back/back.routes').then(m => m.routes) },
  { path: '**', redirectTo: 'front' },
];
