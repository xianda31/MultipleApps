import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { MenuStructure, NavItem, NAVITEM_LOGGING_CRITERIA, NAVITEM_POSITION, NAVITEM_TYPE } from '../../common/interfaces/navitem.interface';
import { Member } from '../../common/interfaces/member.interface';

@Component({
  selector: 'app-front-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, NgbDropdownModule],
  templateUrl: './front-navbar.component.html',
  styleUrl: './front-navbar.component.scss'
})
export class FrontNavbarComponent {
  // @Input() club_name: string = '';
  @Input() imageClubUrl: string | null = null;
  @Input() logoUrl: string | null = null;
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
  @Output() espaceMembre = new EventEmitter<void>();


  NAVITEM_POSITION = NAVITEM_POSITION;
  NAVITEM_TYPE = NAVITEM_TYPE;
  NAVITEM_LOGGING_CRITERIA = NAVITEM_LOGGING_CRITERIA;
}
