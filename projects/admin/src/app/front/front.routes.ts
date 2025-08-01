import { Routes } from '@angular/router';
import { FrontComponent } from './front/front.component';
import { PageNotFoundComponent } from '../common/page-not-found/page-not-found.component';
import { SignInComponent } from '../common/authentification/sign-in/sign-in.component';
import { FrontPageComponent } from './front-page/front-page.component';

export const routes: Routes = [
  { path: '',
     component: FrontComponent,
     children: [
      { path: 'authentification', component: SignInComponent },
      { path: '', component: FrontPageComponent },
      { path: '**', component: PageNotFoundComponent },
     ]
   },
];