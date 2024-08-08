import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminsComponent } from "./admins/admins.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AdminsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'web-site';
}
