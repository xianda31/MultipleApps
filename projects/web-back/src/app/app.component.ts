import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { ToastEvent } from '../../../common/toaster/models/toast-event';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr'; // Import the 'localeFr' variable

@Component({
    selector: 'app-root',
    imports: [CommonModule, RouterOutlet, NavbarComponent, ToasterComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'web-back';
  currentToasts: ToastEvent[] = [];
  season !: string;
  init: boolean = false;

  constructor(
  ) {
    registerLocaleData(localeFr);
  
  }

}
