import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';
import { ToastEvent } from '../../../common/toaster/models/toast-event';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, ToasterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'admin-dashboard';
  currentToasts: ToastEvent[] = [];

  constructor(
  ) {
  }

}
