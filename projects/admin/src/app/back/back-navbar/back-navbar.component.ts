import { Component, Input, OnInit, ViewChildren, QueryList } from '@angular/core';
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
import { REQUEST_STATUS } from '../../common/interfaces/assistance-request.interface';
import { NgbDropdownConfig } from '@ng-bootstrap/ng-bootstrap';


interface NavbarMenu {
  label: string;
  key?: keyof typeof BackNavbarComponent.prototype.mobileMenus;
  icon?: string;
  route?: string;
  minLevel?: number;
  adminOnly?: boolean;
  subMenus?: NavbarMenu[];
  isDev?: boolean;
  isSystem?: boolean;
  isUser?: boolean;
}

@Component({
  selector: 'app-back-navbar',
  standalone: true,
  imports: [CommonModule, NgIf, RouterLink, FormsModule, ReactiveFormsModule, NgbDropdownModule, NgbCollapseModule],
  templateUrl: './back-navbar.component.html',
  styleUrl: './back-navbar.component.scss'
})
export class BackNavbarComponent implements OnInit {
    navbarMenus: NavbarMenu[] = [];
  
  @Input() season: string = '';
  @Input() entries_nbr: number = 0;
  accreditation_level!: number;
  accreditation_levels = Group_priorities;
  production_mode: boolean = false;
  user_accreditation: Accreditation | null = null;
  logged_member$: Observable<Member | null> = new Observable<Member | null>();
  
  avatar$ !: Observable<string>;
  assistances_nbr: number = 0;
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
    private router: Router  ) { }

  ngOnInit(): void {

    // Fermer tous les dropdowns lors de la navigation
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeAllDropdowns();
    });
    
    this.logged_member$ = this.auth.logged_member$;
    this.accreditation_level = -1;
    // Menus statiques (hors User menu)
    let staticMenus: NavbarMenu[] = [
      {
        label: 'Tournois',
        key: 'boutique',
        icon: 'bi-card-checklist',
        route: this.BACK_ROUTE_PATHS.FeesCollector,
        minLevel: this.accreditation_levels.Contributeur
      },
      {
        label: 'Boutique',
        key: 'boutique',
        icon: 'bi-cart',
        minLevel: this.accreditation_levels.Contributeur,
        subMenus: [
          { label: 'vente à adhérents', route: this.BACK_ROUTE_PATHS.Shop },
          { label: 'produits à la vente', route: this.BACK_ROUTE_PATHS.Products }
        ]
      },
      {
        label: 'Adhérents',
        key: 'adherents',
        icon: 'bi-people',
        minLevel: this.accreditation_levels.Contributeur,
        subMenus: [
          { label: 'répertoire', route: this.BACK_ROUTE_PATHS.MembersDatabase },
          { label: 'cartes admission', route: this.BACK_ROUTE_PATHS.GameCardsEditor, adminOnly: true },
          { label: 'contrôles', route: this.BACK_ROUTE_PATHS.MemberSales },
          { label: 'compétitions', route: this.BACK_ROUTE_PATHS.Competitions }
        ]
      },
      {
        label: 'Finance',
        key: 'finance',
        icon: 'bi-journal',
        minLevel: this.accreditation_levels.Administrateur,
        subMenus: [
          { label: 'état de caisse', route: this.BACK_ROUTE_PATHS.CashBoxStatus },
          { label: 'écritures', route: this.BACK_ROUTE_PATHS.BooksEditor },
          { label: 'synthèse', route: this.BACK_ROUTE_PATHS.BooksOverview },
          { label: 'rapprochement bancaire', route: this.BACK_ROUTE_PATHS.BankReconciliation },
          { label: 'résultats', route: this.BACK_ROUTE_PATHS.ExpenseAndRevenue },
          { label: 'bilan', route: this.BACK_ROUTE_PATHS.Balance }
        ]
      },
      {
        label: 'Outils',
        key: 'outils',
        icon: 'bi-database-fill-gear',
        minLevel: this.accreditation_levels.Systeme,
        subMenus: [
          { label: 'base de données', route: this.BACK_ROUTE_PATHS.BooksList },
          { label: 'droits d\'accès', route: this.BACK_ROUTE_PATHS.GroupsList },
          { label: 'configuration', route: this.BACK_ROUTE_PATHS.SysConf },
          { label: 'écriture', route: this.BACK_ROUTE_PATHS.BooksEditor }
        ]
      },

      {
        label: 'Site web',
        key: 'site',
        icon: 'bi-globe2',
        minLevel: this.accreditation_levels.Administrateur,
        subMenus: [
          { label: 'paramètres UI', route: this.BACK_ROUTE_PATHS.UiConf },
          { label: 'les menus', route: this.BACK_ROUTE_PATHS.MenusEditor },
          { label: 'pages et datas', route: this.BACK_ROUTE_PATHS.CMSWrapper },
          { label: 'aller sur le site', route: '/front' }
        ]
      },
      {
        label: 'Communication',
        key: 'communication',
        icon: 'bi-envelope-paper',
        minLevel: this.accreditation_levels.Administrateur,
        subMenus: [
          { label: 'Assistance', route: this.BACK_ROUTE_PATHS.Assistance },
          { label: 'Mailing', route: this.BACK_ROUTE_PATHS.Mailing }
        ]
      },
            {
        label: 'DevTools',
        key: 'devtools',
        icon: 'bi-wrench',
        minLevel: this.accreditation_levels.Systeme,
        isDev: true,
        subMenus: [
          { label: 'écritures', route: this.BACK_ROUTE_PATHS.BooksDebugger },
          { label: 'données S3', route: this.BACK_ROUTE_PATHS.RootVolume },
          { label: 'import excel', route: this.BACK_ROUTE_PATHS.ImportExcel },
          { label: 'clone DB', route: this.BACK_ROUTE_PATHS.CloneDB },
          { label: 'clone S3', route: this.BACK_ROUTE_PATHS.CloneS3 }
        ]
      }
    ];
    // Filtre DevTools si production
    if (environment.production) {
      staticMenus = staticMenus.filter(menu => menu.label !== 'DevTools');
    }

    this.auth.logged_member$.subscribe(async (member) => {
      // Toujours repartir des menus statiques pour éviter les doublons
      this.navbarMenus = [...staticMenus];
      if (member !== null) {
        this.user_accreditation = await this.groupService.getUserAccreditation();
        this.assistanceService.getAllRequests().subscribe(requests => {
          this.assistances_nbr = requests.filter(r => r.status !== REQUEST_STATUS.RESOLVED).length;
        });
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


}