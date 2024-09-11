
import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { AdminsComponent } from './admins/admins.component';
import { LicenseesComponent } from './licensees/licensees.component';
import { TournamentsComponent } from './tournaments/tournaments/tournaments.component';
import { MembersComponent } from './members/members.component';
import { HomePageComponent } from './home-page/home-page.component';
// import { SysConfComponent } from './sys-conf/sys-conf.component';
import { LayoutComponent } from './site-content/layout/layout.component';
import { ArticlesComponent } from './site-content/articles/articles.component';
import { ArticleComponent } from './site-content/article/article.component';
import { TestComponent } from './site-content/files/test/test.component';
import { ImageMgrComponent } from './site-content/files/image-mgr/image-mgr.component';
import { AlbumsComponent } from './site-content/albums/albums.component';

export const routes: Routes = [
    { path: 'tournaments', component: TournamentsComponent },
    { path: 'auth', component: AuthComponent },
    { path: 'admins', component: AdminsComponent },
    { path: 'licensees', component: LicenseesComponent },
    { path: 'members', component: MembersComponent },
    { path: 'home', component: HomePageComponent },
    { path: 'layout', component: LayoutComponent },
    { path: 'articles', component: ArticlesComponent },
    { path: 'article/:id', component: ArticleComponent },
    { path: 'test', component: TestComponent },
    { path: 'imagemgr', component: ImageMgrComponent },
    { path: 'albums', component: AlbumsComponent },
    { path: '**', redirectTo: '/home' },
    { path: '', redirectTo: '/home', pathMatch: 'full' }
];
