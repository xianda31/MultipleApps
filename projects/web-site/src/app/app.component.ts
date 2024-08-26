import { Component } from '@angular/core';
import { Router, RouterOutlet, Routes } from '@angular/router';
import { NavbarComponent } from "./navbar/navbar.component";

import { GenericSimplePageComponent } from './pages/generic-simple-page/generic-simple-page.component';
import { CommonModule } from '@angular/common';
import { Menu } from '../../../common/menu.interface';
import { SiteLayoutService } from '../../../common/site-layout_and_contents/site-layout.service';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'web-site';
  // pages: Page[] = [];
  menus: Menu[] = [];
  loaded = false;

  constructor(
    // private sysconfService: SysConfService,
    private siteLayoutService: SiteLayoutService,
    private router: Router

  ) {

    this.siteLayoutService.menus$.subscribe((menus) => {
      this.menus = menus;
      // this.pages = pages;
      this.updateRoutes();
      this.loaded = true;
    });
  }

  updateRoutes() {

    let addedRoutes: Routes = [];
    this.menus.forEach((menu) => {
      menu.pages?.forEach((page) => {
        console.log('pushing route : {path: %s , component:generic.. data:%s', page.link.replace(' ', '_'), page.id);
        addedRoutes.push({ path: page.link.replace(' ', '_'), component: GenericSimplePageComponent, data: { pageId: page.id } });
      });
    });

    addedRoutes = [...addedRoutes, ...this.router.config];
    this.router.resetConfig(addedRoutes);
    // console.log('routes :', this.router.config);
  }


}
