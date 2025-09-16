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
    if (this.site === 'FFB') {
      this.titleService.setTitle('Redirection vers la FFB - Résultats récents');
      // window.location.href = this.url;
    }
    } 
  
  }