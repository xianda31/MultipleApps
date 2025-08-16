import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-page-in-construction',
  imports: [RouterModule],
  templateUrl: './page-in-construction.component.html',
  styleUrl: './page-in-construction.component.scss'
})
export class PageInConstructionComponent {
 homeLink = '/';
    constructor(private router: Router) {
        const url = this.router.url;
        if (url.startsWith('/front')) {
            this.homeLink = '/front';
        } else if (url.startsWith('/admin')) {
            this.homeLink = '/admin';
        } else {
            this.homeLink = '/';
        }
    }
}
