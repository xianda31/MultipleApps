import { registerLocaleData, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
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
    private router: Router
  ) {
  }

  ngOnInit(): void {
    registerLocaleData(localeFr);


    let entry_point = this.localStorageService.getItem('entry_point');
    entry_point = entry_point ? entry_point : 'front';
    this.router.navigate([entry_point]);


  }

}
