import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { APP_SANDBOX } from './app.config';
import { filter } from 'rxjs/operators';
import { PageViewService } from './common/services/page-view.service';
import { AuthentificationService } from './common/authentification/authentification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})

export class AppComponent implements OnInit {
  sandbox: boolean = false;
  
  constructor(
    @Inject(APP_SANDBOX) sandboxFlag: boolean,
    private router: Router,
    private pageViewService: PageViewService,
    private authService: AuthentificationService,
  ) {
    this.sandbox = sandboxFlag;
  }

  ngOnInit(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.trackPageNavigation(event.url);
    });
  }

  private trackPageNavigation(url: string): void {
    const member = this.authService.currentMember;
    const userId = member?.license_number ?? undefined;
    this.pageViewService.trackVisit(url, userId);
  }
}
