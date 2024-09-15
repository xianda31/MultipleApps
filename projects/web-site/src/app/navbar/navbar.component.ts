import { Component, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { signOut } from 'aws-amplify/auth';
import { Menu } from '../../../../common/menu.interface';
import { ReplacePipe } from '../../../../common/pipes/replace.pipe';
import { Member } from '../../../../common/members/member.interface';
import { AuthentificationModule } from '../../../../common/authentification/authentification.module';
import { AuthentificationService } from '../../../../common/authentification/authentification.service';




@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ReplacePipe, AuthentificationModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  @Input() isSignedIn: boolean = false;
  @Input() siteMenus!: Menu[];
  whoAmI!: Member | null;

  constructor(
    private auth: AuthentificationService
  ) {
    this.auth.whoAmI$.subscribe((member) => {
      this.whoAmI = member;
      // console.log(this.whoAmI);
    });
  }

  async logOut() {
    await signOut();
  }


}
