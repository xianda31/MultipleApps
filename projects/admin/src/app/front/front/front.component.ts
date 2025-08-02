import { Component } from '@angular/core';
import { FrontNavbarComponent } from '../front-navbar/front-navbar.component';
import { LocalStorageService } from '../../back/services/local-storage.service';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule, formatDate } from '@angular/common';
import { TournamentsComponent } from '../../common/tournaments/tournaments/tournaments.component';
import { ToasterComponent } from '../../common/toaster/components/toaster/toaster.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-front',
  imports: [CommonModule,FrontNavbarComponent, RouterModule, TournamentsComponent,ToasterComponent],
  templateUrl: './front.component.html',
  styleUrl: './front.component.scss'
})
export class FrontComponent {
  dayAndMonthFr = '';
  force_refresh = 0; // Flag to force refresh on route activation


  constructor(
    private localStorageService: LocalStorageService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.localStorageService.setItem('entry_point', 'front');
    let today = new Date();
    this.dayAndMonthFr = formatDate(today, 'EEEE d MMMM', 'fr-FR');

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // This runs every time the route is activated (including after the first load)
        console.log('Navigated to FrontComponent');
        this.force_refresh++; // Set the flag to true to force refresh
      });
      
      console.log('FrontComponent.ngOnInit', today); 
  }
}