import { Component } from '@angular/core';
import { TitleService } from './title.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavItemsService } from '../../common/services/navitem.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-title',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './title.component.html',
  styleUrl: './title.component.scss'
})
export class TitleComponent {
  title$!: Observable<string>;
  breadcrumb: Array<{label: string, path: string | null}> = [];

  constructor(
    private titleService: TitleService,
    private navItemsService: NavItemsService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.title$ = this.titleService.Title$;
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.buildBreadcrumb();
    });
    this.buildBreadcrumb();
  }

  buildBreadcrumb(): void {
    const url = this.router.url;
    const segments = url.split('/').filter(seg => seg);
    const breadcrumb: Array<{label: string, path: string | null}> = [];
    let currentPath = '';
    for (const seg of segments) {
      if (seg === 'front') continue; // Ignore 'front' segment
      currentPath += '/' + seg;
      const navitem = this.navItemsService.getMenuStructure().flatMap(mg => [mg.navitem, ...(mg.childs || []).map(c => c.navitem)]).find(ni => ni.path === seg || ni.path === currentPath.replace(/^\//, ''));
      breadcrumb.push({
        label: navitem?.label || seg,
        path: currentPath
      });
    }
    this.breadcrumb = breadcrumb;
  }
}
