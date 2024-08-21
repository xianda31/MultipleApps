import { Component } from '@angular/core';
import { Router, RouterOutlet, Routes } from '@angular/router';
import { NavbarComponent } from "./navbar/navbar.component";

import { GenericSimplePageComponent } from './generic-simple-page/generic-simple-page.component';
import { SysConfService } from '../../../common/sys-conf/sys-conf.service';
import { MenuItem, SiteConf } from '../../../common/sys-conf/sys-conf.interface';
import { CommonModule } from '@angular/common';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'web-site';
  siteConf !: SiteConf;
  loaded = false;

  constructor(
    private sysconfService: SysConfService,
    private router: Router

  ) {
    this.sysconfService.getSysConf().then((data) => {
      this.siteConf = data;
      this.updateRoutes(this.siteConf.web_site_menus);
      this.loaded = true;

    });

    // routes.push({ path: 'news', component: GenericSimplePageComponent, data: { pageId: 'news' } });
  }

  updateRoutes(menus: MenuItem[]) {

    let addedRoutes: Routes = [];
    menus.forEach((menu) => {
      menu.endItems.forEach((endItem) => {
        addedRoutes.push({ path: endItem.link, component: GenericSimplePageComponent, data: { pageId: endItem.pageId } });
      });
    });

    addedRoutes = [...addedRoutes, ...this.router.config];
    this.router.resetConfig(addedRoutes);
    // console.log('routes :', this.router.config);
  }
}
