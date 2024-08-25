import { Routes } from '@angular/router';
import { TournamentsComponent } from './tournaments/tournaments.component';
import { GenericSimplePageComponent } from './generic-simple-page/generic-simple-page.component';
import { HomePageComponent } from './pages/home-page/home-page.component';



export const routes: Routes = [
    { path: 'home', component: HomePageComponent },
    { path: 'tournaments', component: TournamentsComponent },
    { path: '**', redirectTo: 'home' }
];

