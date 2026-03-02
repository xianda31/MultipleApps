import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { MenuStructure, NavItem, NAVITEM_LOGGING_CRITERIA, NAVITEM_POSITION, NAVITEM_TYPE } from '../../common/interfaces/navitem.interface';
import { Member } from '../../common/interfaces/member.interface';

@Component({
  selector: 'app-front-navbar-new',
  standalone: true,
  imports: [CommonModule, RouterLink, NgbDropdownModule],
  templateUrl: './front-navbar-new.component.html',
  styleUrl: './front-navbar-new.component.scss'
})
export class FrontNavbarNewComponent {
  @Input() club_name: string = '';
  @Input() brandNavitem: NavItem | null = null;
  @Input() navbar_menus: MenuStructure = [];
  @Input() logged_member$: Observable<Member | null> = new Observable<Member | null>();
  @Input() avatar$!: Observable<string>;
  @Input() isPortrait: boolean = false;
  @Input() isMobile: boolean = false;
  @Input() label_transformer!: (label: string) => Promise<string>;
  @Input() trackNavitemId!: (index: number, menu: any) => any;
  @Input() onCommand!: (item: NavItem) => void;

  NAVITEM_POSITION = NAVITEM_POSITION;
  NAVITEM_TYPE = NAVITEM_TYPE;
  NAVITEM_LOGGING_CRITERIA = NAVITEM_LOGGING_CRITERIA;
}
