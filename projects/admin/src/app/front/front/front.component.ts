import { Component } from '@angular/core';
import { FrontNavbarComponent } from '../front-navbar/front-navbar.component';
import { LocalStorageService } from '../../back/services/local-storage.service';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule, formatDate } from '@angular/common';
import { ToasterComponent } from '../../common/toaster/components/toaster/toaster.component';
import { filter } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';
import { TitleComponent } from '../title/title.component';

@Component({
  selector: 'app-front',
  imports: [CommonModule, RouterModule, FrontNavbarComponent, TitleComponent, ToasterComponent],
  templateUrl: './front.component.html',
  styleUrl: './front.component.scss'
})
export class FrontComponent {
  today = new Date();
  force_refresh = 0; // Flag to force refresh on route activation
  tournaments_loaded = false; // Flag to indicate if tournaments are loaded

  constructor(
    private localStorageService: LocalStorageService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.localStorageService.setItem('entry_point', 'front');
    let today = new Date();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // This runs every time the route is activated (including after the first load)
        this.force_refresh++; // Set the flag to true to force refresh
      });

  }
}