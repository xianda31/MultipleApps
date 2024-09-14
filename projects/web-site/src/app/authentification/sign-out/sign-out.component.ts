import { Component, OnInit } from '@angular/core';
import { AuthentificationService } from '../authentification.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sign-out',
  standalone: true,
  imports: [],
  templateUrl: './sign-out.component.html',
  styleUrl: './sign-out.component.scss'
})
export class SignOutComponent implements OnInit {

  constructor(
    private auth: AuthentificationService,
    private router: Router

  ) { }
  ngOnInit(): void {
    this.auth.signOut();
    this.auth.whoAmI = null;
    this.router.navigate(['/']);
  }
}
