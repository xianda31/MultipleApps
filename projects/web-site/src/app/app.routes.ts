import { Routes } from '@angular/router';
import { TournamentsComponent } from './tournaments/tournaments.component';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { PersonalDataComponent } from './personal/personal-data/personal-data.component';



export const routes: Routes = [
    { path: 'home', component: HomePageComponent },
    { path: 'tournaments', component: TournamentsComponent },
    { path: 'authentification', loadChildren: () => import('../../../common/authentification/authentification.module').then(m => m.AuthentificationModule) },
    { path: 'personal/data', component: PersonalDataComponent },
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: '**', redirectTo: 'home' }
];

