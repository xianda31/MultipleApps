import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { GroupService } from '../../common/authentification/group.service';
import { Accreditation } from '../../common/authentification/group.interface';
import { Member } from '../../common/interfaces/member.interface';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbDropdownModule, NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { MemberSettingsService } from '../../common/services/member-settings.service';
import { MenuStructure, NavItem, NAVITEM_LOGGING_CRITERIA, NAVITEM_POSITION, NAVITEM_TYPE } from '../../common/interfaces/navitem.interface';
import { environment } from '../../../environments/environment';
import { CommandRegistryService } from '../../common/services/command-registry.service';

@Component({
  selector: 'app-front-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbDropdownModule, NgbCollapseModule, RouterLink],
  templateUrl: './front-navbar.component.html',
  styleUrl: './front-navbar.component.scss'
})
export class FrontNavbarComponent {
  @Input() albums: string[] = [];
  @Input() menus: MenuStructure = [];
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
  private labelCache = new Map<string, Promise<string>>();

  constructor(
    private auth: AuthentificationService,
    private groupService: GroupService,
    private memberSettingsService: MemberSettingsService,
  private commandRegistry: CommandRegistryService


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
}
