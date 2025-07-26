import { Routes } from '@angular/router';
import { CloneDBComponent } from './clone-DB/clone-db.component';

export const routes: Routes = [
  { path: 'cloneDB', component: CloneDBComponent },
  { path: '', redirectTo: 'cloneDB', pathMatch: 'full' }
];
