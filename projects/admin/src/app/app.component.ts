import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { APP_SANDBOX } from './app.config';



@Component({
  selector: 'app-root',
  imports: [RouterModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})


export class AppComponent {
  sandbox: boolean = false;
  constructor(
    @Inject(APP_SANDBOX) sandboxFlag: boolean,
  ) {
    this.sandbox = sandboxFlag;
  }
}
