import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { signOut } from 'aws-amplify/auth';
import { Menu } from '../../../../common/menu.interface';
import { ReplacePipe } from '../../../../common/pipes/replace.pipe';
import { Member } from '../../../../common/members/member.interface';
import { AuthentificationModule } from '../../../../common/authentification/authentification.module';
import { AuthentificationService } from '../../../../common/authentification/authentification.service';
import { MembersService } from '../../../../admin-dashboard/src/app/members/service/members.service';




@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ReplacePipe, AuthentificationModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  @Input() isSignedIn: boolean = false;
  @Input() siteMenus!: Menu[];
  whoAmI!: Member | null;
  logged_in: boolean = false;

  constructor(
    private auth: AuthentificationService,
    private membersService: MembersService
  ) {
  }
  ngOnInit(): void {
    this.auth.logged_member$.subscribe(async (member) => {
      this.whoAmI = member;
      if (this.whoAmI != null) this.logged_in = true;
      // console.log(this.whoAmI);
    });
  }

  async logOut() {
    await signOut();
  }


}
