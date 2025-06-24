import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from "./navbar/navbar.component";

import { CommonModule, registerLocaleData } from '@angular/common';
import { Menu } from '../../../common/menu.interface';
import { SiteLayoutService } from '../../../common/services/site-layout.service';
import localeFr from '@angular/common/locales/fr';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';


@Component({
    selector: 'app-root',
    imports: [CommonModule, RouterOutlet, NavbarComponent, ToasterComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'web-site';
  menus!: Menu[];
  menus_subscription: any;

  constructor(
    private siteLayoutService: SiteLayoutService,
  ) { }

  ngOnDestroy(): void {
    this.menus_subscription.unsubscribe();
  }
  ngOnInit(): void {
    this.menus_subscription = this.siteLayoutService.getMenus().subscribe((menus) => {
      this.menus = menus;
    });

    registerLocaleData(localeFr);
  }




}
