import { Routes } from '@angular/router';
import { TournamentsComponent } from './tournaments/tournaments.component';
import { GenericSimplePageComponent } from './generic-simple-page/generic-simple-page.component';



export const routes: Routes = [
    { path: 'tournaments', component: TournamentsComponent },
    { path: '**', redirectTo: '' }
];

