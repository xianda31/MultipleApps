import { Component } from '@angular/core';
import { TitleService } from '../../../title/title.service';
import { GenericPageComponent } from '../generic-page/generic-page.component';
import { TournamentsComponent } from '../../../../common/tournaments/tournaments/tournaments.component';
import { Router, ActivatedRoute } from '@angular/router';
import { EXTRA_TITLES, MENU_TITLES } from '../../../../common/interfaces/page_snippet.interface';
import { MembersService } from '../../../../common/services/members.service';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { Observable } from 'rxjs';
import { Member } from '../../../../common/interfaces/member.interface';
import { AuthentificationService } from '../../../../common/authentification/authentification.service';
import { CommonModule } from '@angular/common';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule,GenericPageComponent, TournamentsComponent],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss'
})
export class HomePage {
  EXTRA_TITLES = EXTRA_TITLES;
  MENU_TITLES = MENU_TITLES;
  // highlights = EXTRA_TITLES.HIGHLIGHTS;
  licensees = 0;
  // sympathisants = 0;
  logged_member$: Observable<Member | null> = new Observable<Member | null>();
  isMdOrAbove: boolean = false;

  constructor(
    private titleService: TitleService,
    private router: Router,
    private route: ActivatedRoute,
    private membersService: MembersService,
    private systemDataService: SystemDataService,
    private auth: AuthentificationService,
    private breakpointObserver: BreakpointObserver
  ) {
    this.breakpointObserver.observe([Breakpoints.Medium, Breakpoints.Large, Breakpoints.XLarge])
      .subscribe(result => {
        this.isMdOrAbove = result.matches;
      });
  }
  ngOnInit(): void {
    this.logged_member$ = this.auth.logged_member$;

    this.titleService.setTitle('Accueil');
    const season = this.systemDataService.get_today_season();

    this.membersService.listMembers().subscribe((members) => {
      this.licensees = members.filter(m => m.season === season).length;
      // this.sympathisants = members.filter(m => (m.is_sympathisant === true) && (m.season === season)).length;
    });
  }

  onTournamentSelected(tournamentId: number) {
    this.router.navigate(['/front/tournaments', tournamentId],
      { relativeTo: this.route });
  }

  goToNews(event: Event) {
    event.preventDefault();
    this.router.navigate(['/front/news']);
  }
}