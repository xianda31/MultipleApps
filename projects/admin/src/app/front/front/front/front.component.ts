

import { Component, AfterViewInit, ElementRef, ViewChild, HostListener, ViewEncapsulation } from '@angular/core';
import { LocalStorageService } from '../../../back/services/local-storage.service';
import { Router, RouterModule, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TitleComponent } from '../../title/title.component';
import { SiteLayoutService } from '../../../common/services/site-layout.service';
import { SystemDataService } from '../../../common/services/system-data.service';
import { UIConfiguration } from '../../../common/interfaces/ui-conf.interface';
import { FileService } from '../../../common/services/files.service';
import { MenuStructure, NavItem, NAVITEM_LOGGING_CRITERIA, NAVITEM_POSITION, NAVITEM_TYPE } from '../../../common/interfaces/navitem.interface';
import { SandboxService } from '../../../common/services/sandbox.service';
import { NavItemsService } from '../../../common/services/navitem.service';
import { applyUiThemeFromConfig } from '../../../common/utils/ui-utils';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbDropdownModule, NgbCollapseModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { AuthentificationService } from '../../../common/authentification/authentification.service';
import { GroupService } from '../../../common/authentification/group.service';
import { Accreditation } from '../../../common/authentification/group.interface';
import { Member } from '../../../common/interfaces/member.interface';
import { MemberSettingsService } from '../../../common/services/member-settings.service';
import { CommandRegistryService } from '../../../common/services/command-registry.service';
import { FrontNavbarComponent } from '../../front-navbar/front-navbar.component';

@Component({
  selector: 'app-front',
  standalone: true,
  encapsulation: ViewEncapsulation.None, // nécessaire pour que les tooltips fonctionnent
  imports: [CommonModule, RouterModule, TitleComponent, FormsModule, ReactiveFormsModule, NgbDropdownModule, NgbCollapseModule, NgbTooltipModule, RouterLink, FrontNavbarComponent],
  templateUrl: './front.component.html',
  styleUrls: ['./front.component.scss']
})
export class FrontComponent implements AfterViewInit {
    isMobilePortrait = false;
  NAVITEM_LOGGING_CRITERIA = NAVITEM_LOGGING_CRITERIA;
  logged_member$: Observable<Member | null> = new Observable<Member | null>();
  user_accreditation: Accreditation | null = null;
  club_name: string = 'Bridge Club de Saint-Orens';
  lastActiveNavItem: string = '';
  sidebarOpen = false;
  avatar$ !: Observable<string>;
  logged: boolean = false;
  logged_member: Member | null = null;
  private labelCache = new Map<string, Promise<string>>();
  isPortrait = true;
  isMobileLandscape = false;

  @HostListener('window:resize')
  onResize() {
    this.isPortrait = window.innerHeight > window.innerWidth;
    this.isMobileLandscape = window.innerWidth <= 1024 && window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
    this.isMobilePortrait = !this.isLaptopMode && !this.isMobileLandscape && this.isPortrait;
    // Ajoute force-mobile-navbar uniquement en mobile/portrait
    if (this.isMobilePortrait) {
      document.body.classList.add('force-mobile-navbar');
    } else {
      document.body.classList.remove('force-mobile-navbar');
    }
  }

  get isDesktopWidth(): boolean {
    return window.innerWidth >= 768;
  }

  navbar_menus: MenuStructure = [];
  footer_menus: MenuStructure = [];
  NAVITEM_POSITION = NAVITEM_POSITION;
  NAVITEM_TYPE = NAVITEM_TYPE;
  NAVITEM_TYPES = Object.values(NAVITEM_TYPE);
  sandbox : boolean = false;
  albums: string[] = [];
  uiSettings: UIConfiguration | null = null;
  logoUrl: string | null = null;
  imageClubUrl: string | null = null;
  today = new Date();
  @ViewChild('footerBanner', { static: false }) footerBanner!: ElementRef<HTMLElement>;
  @ViewChild('headerBanner', { static: false }) headerBanner!: ElementRef<HTMLElement>;
  private headerObserver?: MutationObserver;
  footerObserver: any;

  constructor(
    private siteLayoutService: SiteLayoutService,
    private sandboxService: SandboxService,
    private navitemService: NavItemsService,
    private localStorageService: LocalStorageService,
    private systemDataService: SystemDataService,
    private fileService: FileService,
    private auth: AuthentificationService,
    private groupService: GroupService,
    private memberSettingsService: MemberSettingsService,
    private commandRegistry: CommandRegistryService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.localStorageService.setItem('entry_point', 'front');
    this.onResize(); // Ensure correct mode on init
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
      const logoPath = u?.template?.club.logo ?? (u as any)?.template?.logo;
      if (logoPath) this.fileService.getPresignedUrl$(logoPath).subscribe({ next: (u2) => this.logoUrl = u2, error: () => this.logoUrl = null });
      const imagePath = u?.template?.club.image ?? (u as any)?.template?.image;
      if (imagePath) this.fileService.getPresignedUrl$(imagePath).subscribe({ next: (u2) => this.imageClubUrl = u2, error: () => this.imageClubUrl = null });
      
      // Récupérer le nom du club depuis la configuration UI (plusieurs emplacements possibles)
      const clubName = u?.template?.club?.name ?? (u as any)?.template?.club_name ?? (u as any)?.template?.club?.club_name;
      if (clubName) this.club_name = clubName;

      // Appliquer les couleurs du front via CSS variables
      applyUiThemeFromConfig(u);
    });

    // --- FrontNavbar fusion ---
    this.onResize(); // Détection initiale de l'orientation
    this.logged_member$ = this.auth.logged_member$;
    this.auth.logged_member$.subscribe(async (member) => {
      if (member !== null) {
        this.logged_member = member;
        this.logged = true;
        this.user_accreditation = await this.groupService.getUserAccreditation();
        this.avatar$ = this.memberSettingsService.getAvatarUrl(member);
        this.memberSettingsService.settingsChange$().subscribe(() => {
          this.avatar$ = this.memberSettingsService.getAvatarUrl(member);
        });
      }
    });
    this.onResize(); // Initial orientation
  }

  get brandNavitem(): NavItem | null {
    if (!this.navbar_menus || this.navbar_menus.length === 0) return null;
    const items = this.navbar_menus.map(mg => mg.navitem);
    return items.find(item => item.position === this.NAVITEM_POSITION.BRAND) || null;
  }

  label_transformer(label: string): Promise<string> {
    const key = label ?? '';
    if (!key) return Promise.resolve('');
    const cached = this.labelCache.get(key);
    if (cached) return cached;
    const p = this.commandRegistry.label_transform(key)
      .catch(err => {
        console.error('label_transform error for', key, err);
        return key;
      });
    this.labelCache.set(key, p);
    return p;
  }

  isNavItemActive(navItem: string): boolean {
    return this.lastActiveNavItem === navItem;
  }

  async signOut() {
    try {
      sessionStorage.clear();
      await this.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  onCommand(item: NavItem) {
    const raw = ((item as any).command_name || item.slug || '').toString();
    this.commandRegistry.execute(raw).catch(err => console.error('Command execution failed:', raw, err));
  }

  EspaceMembre() {
    this.router.navigate(['/front/authentication']);
  }


  ngAfterViewInit(): void {
    this.updateHeaderHeight();
    this.updateFooterHeight();
    this.onResize(); // Ensure correct mode after view init
    // Observe les changements dans le header pour ajuster dynamiquement la hauteur
    if (this.headerBanner && this.headerBanner.nativeElement) {
      this.headerObserver = new MutationObserver(() => {
        this.updateHeaderHeight();
      });
      this.headerObserver.observe(this.headerBanner.nativeElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }
    // Observe les changements dans le footer pour ajuster dynamiquement la hauteur
    if (this.footerBanner && this.footerBanner.nativeElement) {
      this.footerObserver = new MutationObserver(() => {
        this.updateFooterHeight();
      });
      this.footerObserver.observe(this.footerBanner.nativeElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }
  }

  private updateHeaderHeight() {
    setTimeout(() => {
      if (this.headerBanner && this.headerBanner.nativeElement) {
        const height = this.headerBanner.nativeElement.offsetHeight;
        document.documentElement.style.setProperty('--header-height', height + 'px');
      }
    });
  }

  private updateFooterHeight() {
    setTimeout(() => {
      if (this.footerBanner && this.footerBanner.nativeElement) {
        const height = this.footerBanner.nativeElement.offsetHeight;
        document.documentElement.style.setProperty('--footer-height', height + 'px');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.headerObserver) {
      this.headerObserver.disconnect();
    }
    if (this.footerObserver) {
      this.footerObserver.disconnect();
    }
    // Nettoyage Bootstrap : l'offcanvas mobile laisse overflow:hidden sur le body lors d'une navigation Angular
    document.body.style.overflow = '';
    document.body.style.removeProperty('padding-right');
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.offcanvas-backdrop').forEach(el => el.remove());
  }

  /**
   * Returns true if the body has the 'force-mobile-navbar' class, indicating mobile header should be shown (portrait or landscape)
   */
  get isForceMobileHeader(): boolean {
    return document.body.classList.contains('force-mobile-navbar');
  }


  // TrackBy function for ngFor
  trackNavitemId(index: number, menu: any): any {
    return menu?.navitem?.id || menu?.id || index;
  }

    /**
   * Mode laptop : ni mobile/portrait ni mobile/landscape
   */
  get isLaptopMode(): boolean {
    return !this.isMobileLandscape && !this.isPortrait && this.isDesktopWidth;
  }


  @HostListener('window:scroll')
  onScroll() {
    if (this.isLaptopMode) {
      const scrollY = window.scrollY;
      const bannerRow = document.querySelector('.laptop-banner-row') as HTMLElement;
      const navbarRow = document.querySelector('app-front-navbar .laptop-navbar-row') as HTMLElement;
      const contentContainer = document.querySelector('.laptop-content-container') as HTMLElement;
      
      // Seuil basé sur la hauteur du banner (quand il a disparu)
      const stickyThreshold = 44;
      
      if (scrollY < stickyThreshold) {
        // Comportement normal : pas de sticky, tout scroll naturellement
        bannerRow?.classList.remove('scrolled-sticky', 'banner-hidden');
        navbarRow?.classList.remove('scrolled-sticky');
        
        // Reset des styles inline
        if (navbarRow) {
          navbarRow.style.top = '';
        }
        if (bannerRow) {
          bannerRow.style.height = '';
          bannerRow.style.overflow = '';
          bannerRow.style.opacity = '';
        }
        // Supprimer le margin-top compensatoire
        if (contentContainer) {
          contentContainer.style.marginTop = '';
        }
      } else {
        // Sticky uniquement quand banner a disparu
        bannerRow?.classList.add('scrolled-sticky', 'banner-hidden');
        navbarRow?.classList.add('scrolled-sticky');
        
        // Banner caché
        if (bannerRow) {
          bannerRow.style.height = '0px';
          bannerRow.style.overflow = 'hidden';
        }
        
        // Navbar en haut
        if (navbarRow) {
          navbarRow.style.top = '0px';
        }
        
        // Compenser la hauteur de la navbar ET du banner qui sortent du flux
        // Cela évite que le contenu "remonte" brutalement
        if (contentContainer && navbarRow) {
          const navbarHeight = navbarRow.offsetHeight;
          const bannerHeight = 44; // Hauteur du banner qui disparaît
          contentContainer.style.marginTop = `${navbarHeight + bannerHeight}px`;
        }
      }
    }
  }

}