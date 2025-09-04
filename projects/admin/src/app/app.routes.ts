import { Routes } from '@angular/router';
import { AppComponent } from './app.component';

export const routes: Routes = [
  {path : '' , component : AppComponent},
  { path: 'back', loadChildren: () => import('./back.module').then(m => m.BackModule) },
  { path: 'front', loadChildren: () => import('./front.module').then(m => m.FrontModule) },
  { path: '**', redirectTo: 'front' },
];
