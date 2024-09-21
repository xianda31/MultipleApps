import { Injectable } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { SiteLayoutService } from '../../../common/services/site-layout.service';
import { routes } from './app.routes';
import { GenericSimplePageComponent } from './pages/generic-simple-page/generic-simple-page.component';
import { loggedInGuard } from './guards/logged-in.guard';

@Injectable()
export class DynamicRoutesService {
    constructor(
        private router: Router,
        private siteLayoutService: SiteLayoutService) { }

    initRoutes() {
        // console.log('initRoutes');
        return new Promise<Routes>((resolve, reject) => {
            this.siteLayoutService.getMenus().subscribe((menus) => {
                if (menus.length !== 0) {
                    let addedRoutes: Routes = [];
                    menus.forEach((menu) => {
                        menu.pages?.forEach((page) => {
                            addedRoutes.push({
                                path: page.link.replace(' ', '-'),
                                component: GenericSimplePageComponent,
                                canActivate: page.member_only ? [loggedInGuard] : [],
                                data: { pageId: page.id }
                            });
                        });
                    });
                    const newRoutes: Routes = [...addedRoutes, ...routes];
                    this.router.resetConfig(newRoutes);
                    // console.log('routes :', this.router.config);
                    resolve(newRoutes);
                }
            });
        });
    }
}
