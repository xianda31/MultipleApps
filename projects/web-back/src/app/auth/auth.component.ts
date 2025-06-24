import { JsonPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';

@Component({
    selector: 'app-auth',
    imports: [JsonPipe, AmplifyAuthenticatorModule],
    templateUrl: './auth.component.html',
    styleUrl: './auth.component.scss'
})
export class AuthComponent implements OnInit {
  constructor() { }

  user!: any;
  ngOnInit(): void {
    console.log("hello", this.user);

  }

}
