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



@Component({
  selector: 'app-back-navbar',
  standalone: true,
  imports: [CommonModule, NgIf, RouterLink, FormsModule, ReactiveFormsModule, NgbDropdownModule, NgbCollapseModule],
  templateUrl: './back-navbar.component.html',
  styleUrl: './back-navbar.component.scss'
})
export class BackNavbarComponent implements OnInit {
  
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
    private router: Router


  ) { }

  ngOnInit(): void {

    // Fermer tous les dropdowns lors de la navigation
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeAllDropdowns();
    });
    
    this.logged_member$ = this.auth.logged_member$;
    
    this.accreditation_level = -1;
    
    this.auth.logged_member$.subscribe(async (member) => {
      if (member !== null) {
        this.user_accreditation = await this.groupService.getUserAccreditation();
        // this.force_canvas_to_close();
        
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