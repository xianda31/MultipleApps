import { Component } from '@angular/core';
import { FrontNavbarComponent } from '../front-navbar/front-navbar.component';
import { LocalStorageService } from '../../back/services/local-storage.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-front',
  imports: [FrontNavbarComponent, RouterModule],
  templateUrl: './front.component.html',
  styleUrl: './front.component.scss'
})
export class FrontComponent {
    constructor(
      private localStorageService: LocalStorageService,
    ) {
    }

  ngOnInit(): void {
     this.localStorageService.setItem('entry_point', 'front');
  }
}