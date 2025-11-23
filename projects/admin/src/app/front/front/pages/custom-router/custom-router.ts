import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GenericPageComponent } from '../generic-page/generic-page.component';
import { MENU_TITLES } from '../../../../common/interfaces/page_snippet.interface';

@Component({
  selector: 'app-custom-router',
  standalone: true,
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
    const matchedRoute = this.customRoutes.find(r => {
      // Handle dynamic segments like ':title'
      const routeParts = r.path.split('/');
      const pathParts = path.split('/');
      if (routeParts.length !== pathParts.length) return false;
      return routeParts.every((part, index) => {
        // decode the incoming path segment for comparison so encoded titles match
        const decoded = decodeURIComponent(pathParts[index] || '');
        return part.startsWith(':') || part === decoded;
      });
    });

    if (!matchedRoute) {
      this.matchedRoute = null;
      this.router.navigate(['/front/404']);
      return;
    }

    // Extract params
    const routeParts = matchedRoute.path.split('/');
    const pathParts = path.split('/');
    const params: { [key: string]: string } = {};
    routeParts.forEach((part: string, index: number) => {
      if (part.startsWith(':')) {
        // decode param values so components receive the human-readable title
        params[part.substring(1)] = decodeURIComponent(pathParts[index] || '');
      }
    });
    this.matchedRoute = { ...matchedRoute, params };
  }

  customRoutes = [
    { path: 'tournaments/autres_rdv', page_title: MENU_TITLES.AUTRES_RDV },
    { path: 'tournaments/autres_rdv/:title', page_title: MENU_TITLES.AUTRES_RDV },
    { path: 'club/acteurs', page_title: MENU_TITLES.ACTEURS },
    { path: 'club/documents', page_title: MENU_TITLES.DOCUMENTS },
    { path: 'club/bureau', page_title: MENU_TITLES.BUREAU },
    { path: 'club/historique', page_title: MENU_TITLES.HISTOIRE },
    { path: 'école/cours', page_title: MENU_TITLES.COURS },
    { path: 'news', page_title: MENU_TITLES.NEWS },
    { path: 'news/:title', page_title: MENU_TITLES.NEWS },
    { path: 'albums', page_title: MENU_TITLES.ALBUMS },
    { path: 'contacts', page_title: MENU_TITLES.CONTACTS },
    { path: 'legals', page_title: MENU_TITLES.LEGALS },
  ];
}

