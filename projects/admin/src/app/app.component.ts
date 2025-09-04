import { registerLocaleData, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { NavigationEnd } from '@angular/router';
import localeFr from '@angular/common/locales/fr';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LocalStorageService } from './back/services/local-storage.service';



@Component({
  selector: 'app-root',
  imports: [RouterModule, ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(
    private localStorageService: LocalStorageService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {

    registerLocaleData(localeFr);

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const segments = this.router.url.split('/').filter(Boolean); // Segments réels de l'URL
        // console.log('Current URL segments:', segments);
        // Si l'URL est vide => rediriger vers l'entrée point
        if (segments.length === 0) {
          let entry_point = this.localStorageService.getItem('entry_point');
          // console.log('No entry point found, redirecting to stored:', entry_point);
          entry_point = entry_point ? entry_point : 'front';
          this.router.navigate([entry_point],{ relativeTo: this.route});
        }
      };
    });

  }
}
