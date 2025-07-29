import { Routes } from '@angular/router';
import { FrontComponent } from './front/front.component';
import { PageNotFoundComponent } from '../common/page-not-found/page-not-found.component';

export const routes: Routes = [
  { path: '',
    //  component: FrontComponent,
     children: [
       { path: '', component: FrontComponent } 
     ]
   },
   { path: '**', component: PageNotFoundComponent },
];