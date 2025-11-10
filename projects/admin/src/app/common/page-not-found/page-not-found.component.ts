import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';

@Component({
    selector: 'app-page-not-found',
    standalone: true,
    imports: [RouterModule],
    templateUrl: './page-not-found.component.html',
    styleUrl: './page-not-found.component.scss'
})
export class PageNotFoundComponent {
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
