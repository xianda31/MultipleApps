import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { signOut } from 'aws-amplify/auth';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminInComponent } from "../../../../common/authentification/admin-in/admin-in.component";

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule, ReactiveFormsModule, AdminInComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {

  // async logOut() {
  //   await signOut();
  // }
  // @Input() isSignedIn: boolean = false;
}
