import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GenericPageComponent } from '../generic-page/generic-page.component';
import { MENU_TITLES } from '../../../../common/interfaces/page_snippet.interface';

@Component({
  selector: 'app-custom-router',
  imports: [GenericPageComponent],
  templateUrl: './custom-router.html',
  styleUrl: './custom-router.scss'
})
export class CustomRouter implements OnInit {

  matchedRoute: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.url.subscribe(segments => {
      const relative_path = segments.map(s => s.path).join('/');
      this.checkRoute(relative_path);
    });
  }

  checkRoute(path: string) {
    this.matchedRoute = this.customRoutes.find(r => {
      // Handle dynamic segments like ':title'
      const routeParts = r.path.split('/');
      const pathParts = path.split('/');
      if (routeParts.length !== pathParts.length) return false;
      return routeParts.every((part, index) => part.startsWith(':') || part === pathParts[index]);
    });
    if (!this.matchedRoute) {
      this.router.navigate(['/front/404']);
    }
  }

customRoutes = [
  { path: 'club/acteurs', menu_title: MENU_TITLES.ACTEURS },
  { path: 'club/documents', menu_title: MENU_TITLES.DOCUMENTS },
  { path: 'club/bureau', menu_title: MENU_TITLES.BUREAU },
  { path: 'école/cours', menu_title: MENU_TITLES.COURS },
  { path: 'news/:title', menu_title: MENU_TITLES.NEWS },
  { path: 'albums', menu_title: MENU_TITLES.ALBUMS }
];
}

