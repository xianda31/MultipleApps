import { Routes } from '@angular/router';
import { PageNotFoundComponent } from '../common/page-not-found/page-not-found.component';
import { TournamentComponent } from '../common/tournaments/tournament/tournament.component';
import { FrontComponent } from './front/front/front.component';
import { Carousel } from './carousel/carousel';
import { AuthGuard } from '../auth.guard';
import { AlbumComponent } from './album/album.component';


// Minimal, safe front routes used at bootstrap. Dynamic/nav-driven routes
// (home, tournaments listing, purchases, etc.) are injected at runtime
// by the navitem/dynamic routes service to avoid early token-dependent calls.

export const minimal_routes: Routes = [
  {
    path: '',
    component: FrontComponent,
    children: [
      // Routes with dynamic parameters (not configurable via editor)
      // { path: 'tournaments/:id', component: TournamentComponent },
      { path: 'les_albums/:snippet_id', component: AlbumComponent },

      // System routes (redirects and fallbacks)
      { path: 'back_office', redirectTo: '/back', pathMatch: 'full' },
      { path: '404', component: PageNotFoundComponent },
      { path: '**', component: PageNotFoundComponent }, // catch-all route to handle custom routing
    ]
  },
];