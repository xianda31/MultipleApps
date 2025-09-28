import { Component, Input, Renderer2, ElementRef, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { map, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EXTRA_TITLES, MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../../common/interfaces/page_snippet.interface';
import { PageService } from '../../../../common/services/page.service';
import { SnippetService } from '../../../../common/services/snippet.service';
import { TitleService } from '../../../title/title.service';
import { MembersService } from '../../../../common/services/members.service';
import { Member } from '../../../../common/interfaces/member.interface';
import { TrombinoscopeRenderComponent } from './renderers/trombinoscope-render/trombinoscope-render.component';
import { SequentialRenderComponent } from './renderers/sequential-render/sequential-render.component';
import { PublicationRenderComponent } from './renderers/publication-render/publication-render.component';
import { ALaUneRenderComponent } from './renderers/a-la-une-render/a-la-une-render.component';
import { LoadableRenderComponent } from './renderers/loadable-render/loadable-render.component';
import { CardsImgTopRenderComponent } from './renderers/cards-img-top-render/cards-img-top-render.component';
import { CardsImgBottomRenderComponent } from './renderers/cards-img-bottom-render/cards-img-bottom-render.component';
import { AlbumsRenderComponent } from './renderers/albums-render/albums-render.component';
import { FlipperRenderComponent } from './renderers/flipper-render/flipper-render.component';

@Component({
  selector: 'app-generic-page',
  imports: [
    CommonModule,
    TrombinoscopeRenderComponent,
    SequentialRenderComponent,
    PublicationRenderComponent,
    ALaUneRenderComponent,
    LoadableRenderComponent,
    CardsImgTopRenderComponent,
    CardsImgBottomRenderComponent,
    AlbumsRenderComponent,
    FlipperRenderComponent
  ],
  templateUrl: './generic-page.component.html',
  styleUrl: './generic-page.component.scss'
})
export class GenericPageComponent implements OnInit, OnChanges {

  @Input() page_title!: MENU_TITLES | EXTRA_TITLES;
  @Input() snippet_title?: string; // for news, the title of the selected snippet
  page!: Page;
  pageTemplate!: PAGE_TEMPLATES;
  PAGE_TEMPLATES = PAGE_TEMPLATES;
  snippets: Snippet[] = [];

  constructor(
    private snippetService: SnippetService,
    private pageService: PageService,
    private titleService: TitleService,
    private memberService: MembersService,
    private router: Router,
    private renderer: Renderer2,
    private el: ElementRef,
  ) { }


  ngOnChanges(changes: SimpleChanges): void {
    if (changes['page_title'] && !changes['page_title'].firstChange) {
      this.loadPageAndSnippets(this.page_title);
    }
    if (changes['snippet_title'] && !changes['snippet_title'].firstChange && this.page_title === MENU_TITLES.NEWS) {
      // Scroll to the snippet if snippet_title changes
      const snippet = this.snippets.find(s => s.title === this.snippet_title);
      if (snippet) {
        // this.scrollToElement(snippet.title);
      }
    }
  }

  ngOnInit(): void {
    this.init_relative_links_handler();
    this.loadPageAndSnippets(this.page_title);
  }


  loadPageAndSnippets(page_title: MENU_TITLES | EXTRA_TITLES) {

    const title = (page_title === EXTRA_TITLES.HIGHLIGHTS) ? MENU_TITLES.NEWS : page_title;
    // load the page by its title, then load all snippets  for this page

    this.pageService.getPageByTitle(title).pipe(
      map(page => {
        if (!page) { throw new Error(page_title + ' page not found') }
        this.page = page;
        return page;
      }),
      switchMap(() => this.snippetService.listSnippets())
    )
      .subscribe((snippets) => {
        this.snippets = this.page.snippet_ids
          .map(id => snippets.find(snippet => snippet.id === id))
          .filter(snippet => snippet !== undefined) as Snippet[];

        // post traitement de la page
        if (this.snippets.length === 0) {
          console.warn('%s snippets found for page %s: %o', this.snippets.length, this.page.title, this.page.snippet_ids);
        }
        this.page_post_handling();
      });
  }



  page_post_handling() {

    switch (this.page_title) {
      case MENU_TITLES.NEWS:
        this.snippets = this.snippets.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
        this.titleService.setTitle(this.page.title);
        this.pageTemplate = this.page.template;
        break;

      case EXTRA_TITLES.HIGHLIGHTS:
        this.snippets = this.snippets.filter(s => s.featured)
          .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
        this.pageTemplate = PAGE_TEMPLATES.A_LA_UNE;
        break;

      case MENU_TITLES.BIRTHDAYS:

        const snippet_model = this.snippets[0]; // use the first snippet as a model for birthdays snippets

        this.memberService.get_birthdays_this_next_days(7).pipe(
          map((result: { [day: string]: Member[]; }) => {
            const days = Object.keys(result).sort();
            if (days.length === 0) {
              return [];
            }
            return days.map(day => {
              const members_in_day = result[day];

              return {
                id: `birthday_snippet_${day}`,
                title: new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' }),
                content: `<p>` + members_in_day.map(member => ` <span>${member.firstname} ${member.lastname}</span>`).join('<br>') + `</p>`,
                subtitle: 'Joyeux anniversaire à ...',
                public: false,
                image: snippet_model.image,
                image_url: snippet_model.image_url,
                file: '',
                folder: '',
                featured: snippet_model?.featured || false,
              };
            });
          })).subscribe(snippets => {
            this.snippets = snippets;
            this.pageTemplate = this.page.template;
          });
        break;


      default:
        this.titleService.setTitle(this.page.title);
        this.pageTemplate = this.page.template;
        break;
    }

  }



  // handling of DOM events

  // Intercept link clicks for relative URLs
  init_relative_links_handler() {

    this.renderer.listen(this.el.nativeElement, 'click', (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'A') {
        const href = target.getAttribute('href');
        if (href && (/^\/|^\.\/|^\.\./.test(href))) {
          event.preventDefault();
          this.router.navigateByUrl(href);
        } else if (href && (/^#/.test(href))) { // Handle internal anchor links
          event.preventDefault();
          const id = href.substring(1);
          const element = document.getElementById(id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' }); // Smooth scroll to element
          }
        } else if (href) {   // Handle external links
          event.preventDefault();
          window.open(href, '_blank');
        }
      }
    });
  }

  isKnownTemplate(template: PAGE_TEMPLATES): boolean {
    return Object.values(PAGE_TEMPLATES).includes(template);
  }

}
