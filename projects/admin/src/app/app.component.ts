import { Component, Inject, OnInit } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { APP_SANDBOX } from './app.config';
import { filter } from 'rxjs/operators';
import { PageViewService } from './common/services/page-view.service';
import { AuthentificationService } from './common/authentification/authentification.service';
import { FfbAvailabilityService } from './common/services/ffb-availability.service';
import { combineLatest, distinctUntilChanged, map } from 'rxjs';
import { GroupService } from './common/authentification/group.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
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
    private ffbAvailability: FfbAvailabilityService,
    private groupService: GroupService,
  ) {
    this.sandbox = sandboxFlag;
  }

  ngOnInit(): void {
    this.ffbAvailability.startMonitoring();
    combineLatest([
      this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)),
      this.authService.isRestoringSession$,
      this.authService.logged_member$,
    ]).pipe(
      filter(([, isRestoring]) => !isRestoring),
      map(([event, , member]) => ({
        url: event.urlAfterRedirects,
        authenticated: !!member,
      })),
      distinctUntilChanged((previous, current) =>
        previous.url === current.url && previous.authenticated === current.authenticated
      )
    ).subscribe(({ url, authenticated }) => {
      const groupName = authenticated
        ? this.groupService.getCurrentUserGroups().then(groups => groups[0])
        : undefined;
      void this.pageViewService.trackVisit(url, authenticated, groupName);
    });
  }
}
