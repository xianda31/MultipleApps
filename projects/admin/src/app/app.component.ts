import { registerLocaleData, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import localeFr from '@angular/common/locales/fr';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LocalStorageService } from './back/services/local-storage.service';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';



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
    private activatedRoute: ActivatedRoute
  ) {
  }

  ngOnInit(): void {
    registerLocaleData(localeFr);

    // Obtenir les informations de la route active
    const routeSnapshot = this.activatedRoute.snapshot;
    // console.log('Current route URL:', JSON.stringify(routeSnapshot.url));
    // console.log('Route params:', routeSnapshot.params);
    // console.log('Query params:', routeSnapshot.queryParams);
    // console.log('Route data:', routeSnapshot.data);

    // Vérifier si l'URL est vide et rediriger vers l'entrée point
    if (routeSnapshot.url.length === 0) {
      let entry_point = this.localStorageService.getItem('entry_point');
      entry_point = entry_point ? entry_point : 'back';
      console.log('Empty URL detected, redirecting to ', entry_point);
      this.router.navigate([entry_point]);
    }else {
      console.log('Current URL is not empty (' + routeSnapshot.url + '), no redirection needed.');
    }


  }

}
