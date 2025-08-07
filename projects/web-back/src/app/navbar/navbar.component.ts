import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { signOut } from 'aws-amplify/auth';
import { AdminInComponent } from '../../common/authentification/admin-in/admin-in.component';

@Component({
    selector: 'app-navbar',
    imports: [CommonModule, RouterLink, AdminInComponent],
    templateUrl: './navbar.component.html',
    styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  async logOut() {
    await signOut();
  }
  @Input() isSignedIn: boolean = false;
}
