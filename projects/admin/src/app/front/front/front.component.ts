import { Component } from '@angular/core';
import { FrontNavbarComponent } from '../front-navbar/front-navbar.component';
import { LocalStorageService } from '../../back/services/local-storage.service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToasterComponent } from '../../common/toaster/components/toaster/toaster.component';
import { TitleComponent } from '../title/title.component';
import { SiteLayoutService } from '../../common/services/site-layout.service';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-front',
  imports: [CommonModule, RouterModule, FrontNavbarComponent, TitleComponent, ToasterComponent],
  templateUrl: './front.component.html',
  styleUrl: './front.component.scss'
})
export class FrontComponent {
  albums: string[] = [];
  // albums$ : Observable<string[]> = of([]);
  today = new Date();

  constructor(
    private localStorageService: LocalStorageService,
    private siteLayoutService: SiteLayoutService
  ) { }

  ngOnInit(): void {
    this.localStorageService.setItem('entry_point', 'front');

     this.siteLayoutService.getAlbums().subscribe((albums) => {
      this.albums = albums;
      console.log('Albums loaded:', this.albums);
      
    });
  }
}