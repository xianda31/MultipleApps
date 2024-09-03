import { Component } from '@angular/core';
import { Router, RouterOutlet, Routes } from '@angular/router';
import { NavbarComponent } from "./navbar/navbar.component";

import { GenericSimplePageComponent } from './pages/generic-simple-page/generic-simple-page.component';
import { CommonModule, registerLocaleData } from '@angular/common';
import { Menu } from '../../../common/menu.interface';
import { SiteLayoutService } from '../../../common/services/site-layout.service';
import localeFr from '@angular/common/locales/fr';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, ToasterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'web-site';
  menus: Menu[] = [];

  constructor(
    private siteLayoutService: SiteLayoutService,
  ) {

    this.siteLayoutService.menus$.subscribe((menus) => {
      this.menus = menus;
      this.menus = this.menus.map((menu) => {
        menu.pages = menu.pages.sort((a, b) => a.rank - b.rank);
        return menu;
      });
      this.loaded = true;
    });

    registerLocaleData(localeFr);
  }
  loaded = false;




}
