import { Component } from '@angular/core';
import { FrontNavbarComponent } from '../front-navbar/front-navbar.component';
import { LocalStorageService } from '../../back/services/local-storage.service';
import { RouterModule } from '@angular/router';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-front',
  imports: [CommonModule,FrontNavbarComponent, RouterModule],
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