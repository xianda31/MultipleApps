import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthentificationService } from '../authentification.service';

@Component({
    selector: 'app-sign-out',
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
    this.router.navigate(['/']);
  }
}
