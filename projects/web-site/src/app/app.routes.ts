import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { PersonalDataComponent } from './personal/personal-data/personal-data.component';
import { loggedInGuard } from './guards/logged-in.guard';



export const routes: Routes = [
    { path: 'home', component: HomePageComponent },
    {
        path: 'tournaments',
        loadChildren: () => import('../../../common/tournaments/tournaments.module').then(m => m.TournamentsModule),
        canActivate: [loggedInGuard]
    },
    {
        path: 'authentification',
        loadChildren: () => import('../../../common/authentification/authentification.module').then(m => m.AuthentificationModule),
    },
    { path: 'personal/data', component: PersonalDataComponent },
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    { path: '**', redirectTo: 'home' }
];

