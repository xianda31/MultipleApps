
import { Routes } from '@angular/router';
import { AuthComponent } from './auth/auth.component';
import { LicenseesComponent } from './licensees/licensees.component';
import { MembersComponent } from './members/members.component';
import { HomePageComponent } from './home-page/home-page.component';
import { LayoutComponent } from './site-content/layout/layout.component';
import { ArticlesComponent } from './site-content/articles/articles.component';
import { ArticleComponent } from './site-content/article/article.component';
import { ImageMgrComponent } from './site-content/files/image-mgr/image-mgr.component';
import { AlbumsComponent } from './site-content/albums/albums.component';
import { SysConfComponent } from './sys-conf/sys-conf.component';

export const routes: Routes = [
    { path: 'auth', component: AuthComponent },
    { path: 'licensees', component: LicenseesComponent },
    { path: 'members', component: MembersComponent },
    { path: 'home', component: HomePageComponent },
    { path: 'layout', component: LayoutComponent },
    { path: 'articles', component: ArticlesComponent },
    { path: 'article/:id', component: ArticleComponent },
    { path: 'imagemgr', component: ImageMgrComponent },
    { path: 'albums', component: AlbumsComponent },
    // { path: 'sales', loadChildren: () => import('./sales/sales.module').then(m => m.SalesModule) },
    { path: 'sysconf', component: SysConfComponent },
    // { path: 'xls_import', component: XlsImportComponent },

    {
        path: 'tournaments',
        data: { app: 'site-conf' },
        loadChildren: () => import('../../../common/tournaments/tournaments.module').then(m => m.TournamentsModule)
    },

    { path: '**', redirectTo: '/home' },
    { path: '', redirectTo: '/home', pathMatch: 'full' }
];
