import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { GroupService } from '../../common/authentification/group.service';
import { Accreditation } from '../../common/authentification/group.interface';
import { Member } from '../../common/interfaces/member.interface';
import { Offcanvas } from 'bootstrap';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbDropdownModule, NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { Process_flow } from '../../common/authentification/authentification_interface';
import { MemberSettingsService } from '../../common/services/member-settings.service';
import { MenuStructure, NavItem, NAVITEM_LOGGING_CRITERIA, NAVITEM_POSITION, NAVITEM_TYPE } from '../../common/interfaces/navitem.interface';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-front-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbDropdownModule, NgbCollapseModule, RouterLink],
  templateUrl: './front-navbar.component.html',
  styleUrl: './front-navbar.component.scss'
})
export class FrontNavbarComponent {
  @Input() albums: string[] = [];
  @Input() menus: MenuStructure = {};
  @Input() sandboxMode: boolean = false;
  NAVITEM_POSITION = NAVITEM_POSITION;
  NAVITEM_TYPE = NAVITEM_TYPE;
  NAVITEM_TYPES = Object.values(NAVITEM_TYPE);
  NAVITEM_LOGGING_CRITERIA = NAVITEM_LOGGING_CRITERIA;

  logged_member$: Observable<Member | null> = new Observable<Member | null>();
  user_accreditation: Accreditation | null = null;
  lastActiveNavItem: string = '';
  sidebarOpen = false;
  avatar$ !: Observable<string>;

  active_menu_editor: boolean = false;
  logged: boolean = false;
  logged_member: Member | null = null;

  constructor(
    private auth: AuthentificationService,
    private groupService: GroupService,
    private memberSettingsService: MemberSettingsService,


  ) { }
  ngOnInit(): void {

    this.active_menu_editor = environment.active_menu_editor;

    this.logged_member$ = this.auth.logged_member$;

    this.auth.logged_member$.subscribe(async (member) => {
      if (member !== null) {
        this.logged_member = member;
        this.logged = true;
        this.user_accreditation = await this.groupService.getUserAccreditation();
        // this.force_canvas_to_close();
        this.avatar$ = this.memberSettingsService.getAvatarUrl(member);

        this.memberSettingsService.settingsChange$().subscribe(() => {
          this.avatar$ = this.memberSettingsService.getAvatarUrl(member);
        });
      }
    });
  }


  label_transformer(ni: NavItem): string {
    switch (ni.label) {
      case '$$USERNAME$$':
        if (this.logged_member) {
          return this.logged_member.firstname;
        } else {
          throw new Error('No logged member found');
        }
      default:
        return ni.label;
    }
  }

  isNavItemActive(navItem: string): boolean {
    return this.lastActiveNavItem === navItem;
  }
  // onCanvasClose() {
  //   this.auth.changeMode(Process_flow.SIGN_IN);
  // }


  // force_canvas_to_close() {
  //   const canvas = document.getElementById('loggingOffCanvas');
  //   if (canvas) {
  //     const bsOffcanvas = Offcanvas.getInstance(canvas);
  //     if (bsOffcanvas) {
  //       bsOffcanvas.hide();
  //       setTimeout(() => {
  //         canvas.classList.remove('show');
  //         const backdrop = document.querySelector('.offcanvas-backdrop');
  //         if (backdrop) {
  //           backdrop.parentNode?.removeChild(backdrop);
  //         }
  //         document.body.classList.remove('offcanvas-backdrop', 'show', 'modal-open');
  //       }, 300);
  //     }
  //   }
  // }

  async signOut() {
    try {
      sessionStorage.clear();
      await this.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
}
