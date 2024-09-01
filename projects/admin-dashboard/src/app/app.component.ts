import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { ToastService } from '../../../common/toaster/toast.service';
import { ToasterComponent } from '../../../common/toaster/components/toaster/toaster.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, ToasterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'admin-dashboard';

  constructor(
    private toastService: ToastService,
  ) {
    console.log('app component initialized');
    this.toastService.showInfoToast('dashboard', 'Welcome to the Admin Dashboard');
  }
}
