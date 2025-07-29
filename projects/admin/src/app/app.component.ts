import { registerLocaleData, CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import localeFr from '@angular/common/locales/fr';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LocalStorageService } from './services/local-storage.service';



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


    const entry_point = this.localStorageService.getItem('entry_point');
    if (entry_point) {
      console.log('Entry point found in local storage:', entry_point);
      this.router.navigate(['admin']).catch(err => {
        console.error('Error navigating to entry point:', err);
      });
    } else {
      console.log('No entry point found in local storage, navigating to default route.');
      this.router.navigate(['admin']).catch(err => {
        console.error('Error navigating to entry point:', err);
      });
      this.localStorageService.setItem('entry_point', 'admin');
    }


  }

}
