
import { Component, Input, Renderer2, ElementRef, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { combineLatest, switchMap } from 'rxjs';
import { EXTRA_TITLES, MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../../common/interfaces/page_snippet.interface';
import { PageService } from '../../../../common/services/page.service';
import { SnippetService } from '../../../../common/services/snippet.service';
import { TitleService } from '../../../title/title.service';
import { TrombinoscopeRenderComponent } from './renderers/trombinoscope-render/trombinoscope-render.component';
import { SequentialRenderComponent } from './renderers/sequential-render/sequential-render.component';
import { PublicationRenderComponent } from './renderers/publication-render/publication-render.component';
import { ALaUneRenderComponent } from './renderers/a-la-une-render/a-la-une-render.component';
import { LoadableRenderComponent } from './renderers/loadable-render/loadable-render.component';
import { CardsImgTopRenderComponent } from './renderers/cards-img-top-render/cards-img-top-render.component';
import { CardsImgBottomRenderComponent } from './renderers/cards-img-bottom-render/cards-img-bottom-render.component';
import { CardsImgTopLeftRenderComponent } from './renderers/cards-img-top-left-render/cards-img-top-left-render.component';
import { AlbumsRenderComponent } from './renderers/albums-render/albums-render.component';
import { BreakpointsSettings } from '../../../../common/interfaces/ui-conf.interface';

@Component({
  selector: 'app-generic-page',
  standalone: true,
  imports: [
    CommonModule,
    TrombinoscopeRenderComponent,
    SequentialRenderComponent,
    PublicationRenderComponent,
    ALaUneRenderComponent,
    LoadableRenderComponent,
    CardsImgTopRenderComponent,
    CardsImgTopLeftRenderComponent,
    CardsImgBottomRenderComponent,
    AlbumsRenderComponent,
  ],
  templateUrl: './generic-page.component.html',
  styleUrl: './generic-page.component.scss'
})
export class GenericPageComponent implements OnInit, OnChanges {

  @Input() page_title!: string;
  @Input() snippet_title?: string; // for news, the title of the selected snippet
  @Input() row_cols: BreakpointsSettings = { SM: 1, MD: 2, LG: 3, XL: 4 };
  @Input() page_snippets: Snippet[] = []; // Allow external snippets to be passed in
  page!: Page;
  pages: Page[] = [];
  pageTemplate!: PAGE_TEMPLATES;
  PAGE_TEMPLATES = PAGE_TEMPLATES;
  snippets: Snippet[] = [];
  scroll_to_snippet?: Snippet;

  constructor(
    private snippetService: SnippetService,
    private pageService: PageService,
    private titleService: TitleService,
    private router: Router,
    private renderer: Renderer2,
    private el: ElementRef,
  ) {
  }


  ngOnChanges(changes: SimpleChanges): void {

    if (changes['page_title'] && !changes['page_title'].firstChange) {
      this.filter_PageSnippets(this.page_title);
    }
    if (changes['snippet_title'] && !changes['snippet_title'].firstChange && this.page_title === MENU_TITLES.NEWS) {
      // Scroll to the snippet if snippet_title changes
      const snippet = this.snippets.find(s => s.title === this.snippet_title);
      if (snippet) {
        this.scroll_to_snippet = snippet;
      }
    }

    // Handle external page_snippets changes (e.g., from CMS wrapper)
    if (changes['page_snippets'] && !changes['page_snippets'].firstChange) {
      this.applyPageConfiguration(this.page_title);
    }
  }

  ngOnInit(): void {
    this.init_relative_links_handler();

    combineLatest([this.pageService.listPages(), this.snippetService.listSnippets()])
      .subscribe(([pages, snippets]) => {
        this.pages = pages;
        this.snippets = snippets.map(s => {
          s.pageId = undefined;
          // Initialize publishedAt from updatedAt (ISO) converted to YYYY-MM-DD
          if (!s.publishedAt) {
            s.publishedAt = this.toDateInputValue(s.updatedAt) || '';
          }
          return s;
        });
        // Update pageId for all snippets
        this.pages.forEach(page => {
          page.snippet_ids.forEach(id => {
            const snippet = this.snippets.find(s => s.id === id);
            if (snippet) {
              snippet.pageId = page.title;
            }
          });
        });
        this.filter_PageSnippets(this.page_title);
        // If target snippet title is provided initially, set scroll target
        if (this.snippet_title) {
          const target = this.page_snippets.find(s => s.title === this.snippet_title);
          if (target) {
            this.scroll_to_snippet = target;
          }
        }
      });
  }

  filter_PageSnippets(page_title: string) {

    if (page_title === EXTRA_TITLES.HIGHLIGHTS) {
      this.page_snippets = this.snippets.filter(s => s.featured)
        .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
      this.pageTemplate = PAGE_TEMPLATES.A_LA_UNE;
      return;
    }

    const title = page_title;
    // load the page by its title, then load all snippets  for this page
    const page = this.pages.find(p => p.title === title);
    if (!page) {
      // Page not found - this can happen temporarily during title editing in CMS
      console.warn(`GenericPage: page "${page_title}" not found in pages list - waiting for sync`);
      return;
    }
    this.page = page;

    // Load page_snippets from page snippet IDs if not provided externally
    if (!Array.isArray(this.page_snippets) || this.page_snippets.length === 0) {
      this.page_snippets = page.snippet_ids
        .map(id => this.snippets.find(snippet => snippet.id === id))
        .filter(snippet => snippet !== undefined) as Snippet[];
    }

    // Apply page-specific configuration
    this.applyPageConfiguration(page_title);
  }

  private applyPageConfiguration(page_title: string) {
    if (page_title === MENU_TITLES.NEWS) {
      this.page_snippets = this.page_snippets.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
      this.titleService.setTitle('Les actualités');
    } else {
      this.titleService.setTitle(this.page.title);
    }
    this.pageTemplate = this.page.template;
  }



  // handling of DOM events

  // Intercept link clicks for relative URLs
  init_relative_links_handler() {

    this.renderer.listen(this.el.nativeElement, 'click', (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'A') {
        let href = target.getAttribute('href');
        if (!href) return;
        // Liens internes (/, ./, ../)
        if (/^(\/|\.\/|\.\.)/.test(href)) {
          event.preventDefault();
          // Normalise ./front/les_albums ou ../ en chemin absolu
          if (href.startsWith('./')) {
            href = '/' + href.slice(2);
          } else if (href.startsWith('../')) {
            // Pour ../, on enlève les ../ et on repart de la racine
            while (href.startsWith('../')) {
              href = href.slice(3);
            }
            href = '/' + href;
          }
          // Si le lien commence déjà par /, on route tel quel
          this.router.navigateByUrl(href);
        } else if (/^#/.test(href)) { // Liens d'ancre internes
          event.preventDefault();
          const id = href.substring(1);
          const element = document.getElementById(id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        } else if (/^https?:\/\//i.test(href)) {
          // Lien externe : ouvrir dans un nouvel onglet
          event.preventDefault();
          window.open(href, '_blank', 'noopener');
        } else {
          // Autres cas (ex: mailto, tel, etc.) : laisser le comportement natif
        }
      }
    });
  }

  isKnownTemplate(template: PAGE_TEMPLATES): boolean {
    return Object.values(PAGE_TEMPLATES).includes(template);
  }


  private toDateInputValue(value: any): string | undefined {
    if (!value) return undefined;
    const d = (value instanceof Date) ? value : new Date(value);
    if (isNaN(d.getTime())) return undefined;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
