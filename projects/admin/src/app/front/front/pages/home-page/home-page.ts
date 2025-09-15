import { Component } from '@angular/core';
import { TitleService } from '../../../title.service';
import { GenericPageComponent } from '../generic-page/generic-page.component';
import { TournamentsComponent } from '../../../../common/tournaments/tournaments/tournaments.component';
import { Router, ActivatedRoute } from '@angular/router';
import { MENU_TITLES } from '../../../../common/interfaces/page_snippet.interface';

@Component({
  selector: 'app-home-page',
  imports: [GenericPageComponent, TournamentsComponent],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss'
})
export class HomePage {
   news_page = MENU_TITLES.HIGHLIGHTS;
  constructor(
    private titleService: TitleService,
        private router: Router,
        private route: ActivatedRoute,
    
  ) { }
  ngOnInit(): void {
    this.titleService.setTitle('Accueil');
  }

  onTournamentSelected(tournamentId: number) {
        this.router.navigate(['/front/tournaments', tournamentId],
      { relativeTo: this.route });
  }
}