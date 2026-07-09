import { Component, Input, OnInit, OnDestroy, ViewChildren, QueryList } from '@angular/core';
import { BACK_ROUTE_PATHS } from '../routes/back-route-paths';
import { CommonModule, NgIf } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Group_names, Group_priorities } from '../../common/authentification/group.interface';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { GroupService } from '../../common/authentification/group.service';
import { environment } from '../../../environments/environment';
import { NgbCollapseModule, NgbDropdown, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Accreditation } from '../../common/authentification/group.interface';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Member } from '../../common/interfaces/member.interface';
import { MemberSettingsService } from '../../common/services/member-settings.service';
import { AssistanceRequestService } from '../../common/services/assistance-request.service';
import { NavbarMenu } from './back-navbar.interface';
import { STATIC_MENUS } from './back-navbar.definition';
import { BreakingNewsService } from '../breaking-news/breaking-news.service';
import { SystemDataService } from '../../common/services/system-data.service';



@Component({
  selector: 'app-back-navbar',
  standalone: true,
  imports: [CommonModule, NgIf, RouterLink, FormsModule, ReactiveFormsModule, NgbDropdownModule, NgbCollapseModule],
  templateUrl: './back-navbar.component.html',
  styleUrl: './back-navbar.component.scss'
})
export class BackNavbarComponent implements OnInit, OnDestroy {
    navbarMenus: NavbarMenu[] = STATIC_MENUS;
  private compactLandscapeMql: MediaQueryList | null = null;
  private compactLandscapeListener?: (event: MediaQueryListEvent) => void;
  
  @Input() season: string = '';
  @Input() entries_nbr: number = 0;
  @Input() loading: boolean = false;
  today_season: string = '';
  accreditation_level!: number;
  accreditation_levels = Group_priorities;
  production_mode: boolean = false;
  user_accreditation: Accreditation | null = null;
  logged_member$: Observable<Member | null> = new Observable<Member | null>();
  
  avatar$ !: Observable<string>;
  assistances_nbr : number = 0;
  authorizationFlag$: Observable<boolean>;
 BACK_ROUTE_PATHS = BACK_ROUTE_PATHS;
  
  // Mobile menu collapse states
  mobileMenus = {
    boutique: false,
    adherents: false,
    finance: false,
    outils: false,
    devtools: false,
    site: false,
    communication: false,
    user: false
  };

  @ViewChildren(NgbDropdown) dropdowns!: QueryList<NgbDropdown>;

  closeAllDropdowns() {
    this.dropdowns?.forEach(dropdown => dropdown.close());
  }

  toggleMobileMenu(menu: keyof typeof this.mobileMenus) {
    this.mobileMenus[menu] = !this.mobileMenus[menu];
  }

  closeAllMobileMenus() {
    Object.keys(this.mobileMenus).forEach(key => {
      this.mobileMenus[key as keyof typeof this.mobileMenus] = false;
    });
  }

  constructor(
    private auth: AuthentificationService,
    private groupService: GroupService,
    private memberSettingsService: MemberSettingsService,
    private assistanceService: AssistanceRequestService,
    private router: Router,
    public breakingNewsService: BreakingNewsService,
    private systemDataService: SystemDataService,
  ) { 
    this.authorizationFlag$ = this.breakingNewsService.authorizationFlag$;
  }

  ngOnDestroy(): void {
    // Nettoyage Bootstrap : l'offcanvas mobile laisse overflow:hidden sur le body lors d'une navigation Angular
    document.body.style.overflow = '';
    document.body.style.removeProperty('padding-right');
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.offcanvas-backdrop').forEach(el => el.remove());
    document.body.classList.remove('force-mobile-navbar');

    if (this.compactLandscapeMql && this.compactLandscapeListener) {
      this.compactLandscapeMql.removeEventListener('change', this.compactLandscapeListener);
    }
  }

  ngOnInit(): void {
    this.today_season = this.systemDataService.get_today_season();

    this.assistanceService.getOpenRequestsCount().subscribe(count => {
      this.assistances_nbr = count;
    });
    // Fermer tous les dropdowns lors de la navigation
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeAllDropdowns();
    });
    
    this.logged_member$ = this.auth.logged_member$;
    this.accreditation_level = -1;
    
    let staticMenus = [...this.navbarMenus]; // Copier les menus statiques pour éviter de les modifier directement
    // Filtre DevTools si production
    if (environment.production) {
      staticMenus = staticMenus.filter(menu => menu.label !== 'DevTools');
    }

    this.auth.logged_member$.subscribe(async (member) => {
      // Toujours repartir des menus statiques pour éviter les doublons
      this.navbarMenus = [...staticMenus];
      if (member !== null) {
        this.user_accreditation = await this.groupService.getUserAccreditation();
   
        this.avatar$ = this.memberSettingsService.getAvatarUrl(member);
        this.memberSettingsService.settingsChange$().subscribe(() => {
          this.avatar$ = this.memberSettingsService.getAvatarUrl(member);
        });
        let groups = await this.groupService.getCurrentUserGroups();
        if (groups.length > 0) {
          let group = groups[0] as Group_names;
          this.accreditation_level = Group_priorities[group];
        }
        // Ajout dynamique du User menu à la fin
        this.navbarMenus.push({
          label: member.firstname,
          icon: 'bi-person-circle',
          isUser: true,
          subMenus: [
            { label: 'Déconnexion', route: this.BACK_ROUTE_PATHS.SignOut, icon: 'bi-box-arrow-right' }
          ]
        });
      }
    });
    this.production_mode = environment.production;

    // In compact phone landscape, force the mobile navbar to avoid desktop-width overflow.
    this.compactLandscapeMql = window.matchMedia('(orientation: landscape) and (max-height: 520px) and (max-width: 991.98px)');
    this.applyCompactNavbarMode(this.compactLandscapeMql.matches);
    this.compactLandscapeListener = (event: MediaQueryListEvent) => {
      this.applyCompactNavbarMode(event.matches);
    };
    this.compactLandscapeMql.addEventListener('change', this.compactLandscapeListener);
  }

  private applyCompactNavbarMode(enabled: boolean): void {
    document.body.classList.toggle('force-mobile-navbar', enabled);
  }

  async signOut() {
    try {
      sessionStorage.clear();
      this.accreditation_level = -1;

      await this.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  go_to_prev_season() {
    this.systemDataService.set_local_season(this.systemDataService.previous_season(this.season));
  }

  go_to_next_season() {
    this.systemDataService.set_local_season(this.systemDataService.next_season(this.season));
  }

  go_to_assistance() {
    this.router.navigate([this.BACK_ROUTE_PATHS.Assistance]);
  }

}