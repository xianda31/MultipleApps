import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { signOut } from 'aws-amplify/auth';
import { Menu } from '../../../../common/menu.interface';
import { ReplacePipe } from '../../../../common/pipes/replace.pipe';




@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ReplacePipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  @Input() isSignedIn: boolean = false;
  @Input() siteMenus!: Menu[];

  constructor() { }

  async logOut() {
    await signOut();
  }


}
