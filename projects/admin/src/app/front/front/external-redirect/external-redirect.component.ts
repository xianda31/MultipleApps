import { Component } from '@angular/core';
import { TitleService } from '../../title/title.service';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-external-redirect',
  templateUrl: './external-redirect.component.html',
  imports: [CommonModule],
 
})
export class ExternalRedirectComponent {
  url: string = '';
  site: string = '';
  constructor(
    private titleService: TitleService,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.site = this.route.snapshot.data['site'];
    switch (this.site) {
      case 'FFB':
        this.url = 'https://www.ffbridge.fr/competitions/resultats-recent/';
        this.titleService.setTitle('Redirection vers la FFB - Résultats récents');
        // window.location.href = this.url;
        break;
      case 'FFB_dashboard':
        this.url = 'https://www.ffbridge.fr/user/dashboard/';
        this.titleService.setTitle('Redirection vers votre dashboard FFB');
        // window.location.href = this.url;
        break;
      default:
        this.url = '/front/404';
        this.titleService.setTitle('Page non trouvée');
        // window.location.href = this.url;
        break;
    }
    } 
  
  }