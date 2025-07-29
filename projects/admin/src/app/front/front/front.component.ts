import { Component } from '@angular/core';
import { FrontModule } from '../front.module';
import { FrontNavbarComponent } from '../front-navbar/front-navbar.component';
import { LocalStorageService } from '../../back/services/local-storage.service';

@Component({
  selector: 'app-front',
  imports: [FrontNavbarComponent],
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