import { Component } from '@angular/core';
import { FrontNavbarComponent } from '../../front-navbar/front-navbar.component';
import { LocalStorageService } from '../../../back/services/local-storage.service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { TitleComponent } from '../../title/title.component';
import { SiteLayoutService } from '../../../common/services/site-layout.service';
import {  MenuStructure, NAVITEM_POSITION, NAVITEM_TYPE } from '../../../common/interfaces/navitem.interface';
import { SandboxService } from '../../../common/services/sandbox.service';
import { NavItemsService } from '../../../common/services/navitem.service';

@Component({
  selector: 'app-front',
  standalone: true,
  imports: [CommonModule, RouterModule, FrontNavbarComponent, TitleComponent, ToasterComponent],
  templateUrl: './front.component.html',
  styleUrl: './front.component.scss'
})
export class FrontComponent {
  add_menus: MenuStructure = [];
  NAVITEM_POSITION = NAVITEM_POSITION;
  NAVITEM_TYPE = NAVITEM_TYPE;
  NAVITEM_TYPES = Object.values(NAVITEM_TYPE);
  sandbox : boolean = false;
  albums: string[] = [];
  // albums$ : Observable<string[]> = of([]);
  today = new Date();

  constructor(
    private siteLayoutService: SiteLayoutService,
      private sandboxService: SandboxService,
      private navitemService: NavItemsService,
      private localStorageService: LocalStorageService,
  ) { }

  ngOnInit(): void {

     this.localStorageService.setItem('entry_point', 'front');

    this.siteLayoutService.getAlbums().subscribe((albums) => {
      this.albums = albums;
    });

    this.add_menus = this.navitemService.getMenuStructure();
    // Subscribe sandbox mode to force navbar visual indicator refresh if needed
    this.sandboxService.sandbox$.subscribe((sandbox) => {
      // trigger change detection by simple assignment if menus depend on mode later
      this.sandbox = sandbox;
      this.add_menus = this.navitemService.getMenuStructure();
    });
  }
}