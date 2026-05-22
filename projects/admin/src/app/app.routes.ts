import { Routes } from '@angular/router';
import { EntryRedirectComponent } from './entry-redirect.component';

export const routes: Routes = [
  { path: '', component: EntryRedirectComponent },
  // Page publique survey — hors module front (indépendant du système de routes dynamiques)
  {
    path: 'front/sondage',
    loadComponent: () =>
      import('./front/survey-respond/survey-respond.component')
        .then(c => c.SurveyRespondComponent),
  },
  { path: 'front', loadChildren: () => import('./front.module').then(m => m.FrontModule) },
  { path: 'back', loadChildren: () => import('./back/back.routes').then(m => m.routes) },
  { path: '**', redirectTo: 'front' },
];
