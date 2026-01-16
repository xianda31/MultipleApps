import { Component } from '@angular/core';
import { FrontNavbarComponent } from '../../front-navbar/front-navbar.component';
import { LocalStorageService } from '../../../back/services/local-storage.service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { TitleComponent } from '../../title/title.component';
import { SiteLayoutService } from '../../../common/services/site-layout.service';
import { SystemDataService } from '../../../common/services/system-data.service';
import { UIConfiguration } from '../../../common/interfaces/ui-conf.interface';
import { FileService } from '../../../common/services/files.service';
import {  MenuStructure, NAVITEM_POSITION, NAVITEM_TYPE } from '../../../common/interfaces/navitem.interface';
import { SandboxService } from '../../../common/services/sandbox.service';
import { NavItemsService } from '../../../common/services/navitem.service';
import { applyUiThemeFromConfig } from '../../../common/utils/ui-utils';

@Component({
  selector: 'app-front',
  standalone: true,
  imports: [CommonModule, RouterModule, FrontNavbarComponent, TitleComponent, ToasterComponent],
  templateUrl: './front.component.html',
  styleUrl: './front.component.scss'
})
export class FrontComponent {
  navbar_menus: MenuStructure = [];
  footer_menus: MenuStructure = [];
  NAVITEM_POSITION = NAVITEM_POSITION;
  NAVITEM_TYPE = NAVITEM_TYPE;
  NAVITEM_TYPES = Object.values(NAVITEM_TYPE);
  sandbox : boolean = false;
  albums: string[] = [];
  uiSettings: UIConfiguration | null = null;
  logoUrl: string | null = null;
  today = new Date();

  constructor(
    private siteLayoutService: SiteLayoutService,
      private sandboxService: SandboxService,
      private navitemService: NavItemsService,
      private localStorageService: LocalStorageService,
      private systemDataService: SystemDataService,
      private fileService: FileService,
  ) { }

  ngOnInit(): void {

     this.localStorageService.setItem('entry_point', 'front');

    this.siteLayoutService.getAlbums().subscribe((albums) => {
      this.albums = albums;
    });

    // Load initial navitems based on current sandbox mode
    const initialSandbox = this.sandboxService.value;
    this.navitemService.loadNavItems(initialSandbox).subscribe(() => {
      this.navbar_menus = this.navitemService.getMenuStructure();
      this.footer_menus = this.navitemService.getMenuStructure().filter(menu => menu.navitem.position === NAVITEM_POSITION.FOOTER);
    });

    // Subscribe sandbox mode to reload navitems when mode changes
    this.sandboxService.sandbox$.subscribe((sandbox) => {
      this.sandbox = sandbox;
      // Reload navitems for the new mode
      this.navitemService.loadNavItems(sandbox).subscribe(() => {
        this.navbar_menus = this.navitemService.getMenuStructure();
        this.footer_menus = this.navitemService.getMenuStructure().filter(menu => menu.navitem.position === NAVITEM_POSITION.FOOTER);
      });
    });

    // Load UI settings (logo/background) from dedicated UI settings file
    this.systemDataService.get_ui_settings().subscribe((ui: UIConfiguration) => {
      const u: UIConfiguration = ui || {};
      this.uiSettings = u;
      const logoPath = u?.template?.logo_path;
      if (logoPath) this.fileService.getPresignedUrl$(logoPath).subscribe({ next: (u2) => this.logoUrl = u2, error: () => this.logoUrl = null });
      // Appliquer les couleurs du front via CSS variables
      applyUiThemeFromConfig(u);
    });
  }
}