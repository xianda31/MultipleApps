import { Component, Input, Renderer2, ElementRef, OnChanges, SimpleChanges, OnInit, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { map, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EXTRA_TITLES, MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../../common/interfaces/page_snippet.interface';
import { FileService } from '../../../../common/services/files.service';
import { PageService } from '../../../../common/services/page.service';
import { SnippetService } from '../../../../common/services/snippet.service';
import { ToastService } from '../../../../common/services/toast.service';
import { TitleService } from '../../../title/title.service';
import { NgbDropdownModule, NgbModule, NgbTooltipModule } from "@ng-bootstrap/ng-bootstrap";
import { MembersService } from '../../../../common/services/members.service';
import { Member } from '../../../../common/interfaces/member.interface';
import { TrombinoscopeRenderComponent } from './renders/trombinoscope-render/trombinoscope-render.component';
import { SequentialRenderComponent } from './renders/sequential-render/sequential-render.component';
import { PublicationRenderComponent } from './renders/publication-render/publication-render.component';
import { ALaUneRenderComponent } from './renders/a-la-une-render/a-la-une-render.component';
import { LoadableRenderComponent } from './renders/loadable-render/loadable-render.component';
import { CardsImgTopRenderComponent } from './renders/cards-img-top-render/cards-img-top-render.component';
import { CardsImgBottomRenderComponent } from './renders/cards-img-bottom-render/cards-img-bottom-render.component';
import { AlbumsRenderComponent } from './renders/albums-render/albums-render.component';
import { FlipperRenderComponent } from './renders/flipper-render/flipper-render.component';

@Component({
  selector: 'app-generic-page',
  imports: [
    CommonModule,
    NgbModule,
    NgbTooltipModule,
    NgbDropdownModule,
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
export class GenericPageComponent implements OnInit,OnChanges {

  // @ViewChild('textRef', { static: false }) textRef!: ElementRef;
  // textHeight: number = 0;


  @Input() page_title!: MENU_TITLES | EXTRA_TITLES;
  @Input() snippet_title?: string; // for news, the title of the selected snippet
  page!: Page;
  pageTemplate!: PAGE_TEMPLATES;
  PAGE_TEMPLATES = PAGE_TEMPLATES;
  snippets: Snippet[] = [];

  TRUNCATE_LIMIT = 300; //  truncating news content
  TRUNCATE_HYSTERISIS = 50; // threshold to show "Read more" link

 

  FLIPPER_PERIOD = 10000; // ms
  ROTATION_DURATION = 4000; // ms
  currentIndex = 0;
  flipperInterval: any;

  constructor(
    private snippetService: SnippetService,
    private pageService: PageService,
    private titleService: TitleService,
    private toastService: ToastService,
    private memberService: MembersService,
    private router: Router,
    private renderer: Renderer2,
    private el: ElementRef,
    // private cdr: ChangeDetectorRef
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

  ngOnDestroy() {
    if (this.flipperInterval) {
      clearInterval(this.flipperInterval);
    }
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
        // get the snippets for this page
        console.log('%s snippets loaded', snippets.length);
        // check for correct loading of  page's snippets
        this.snippets = this.page.snippet_ids
          .map(id => snippets.find(snippet => snippet.id === id))
          .filter(snippet => snippet !== undefined) as Snippet[];  // filter out undefined values

        // post traitement de la page
        if (this.snippets.length === 0) {
          // throw new Error(`No snippets found for page ${this.page.title}`);
          console.warn('%s snippets found for page %s: %o', this.snippets.length, this.page.title, this.page.snippet_ids);
        }
        this.page_post_handling();
        // Flip automatique après chargement des snippets
        if (this.pageTemplate === PAGE_TEMPLATES.FLIPPER && this.snippets.length > 1) {
          if (this.flipperInterval) clearInterval(this.flipperInterval);
          this.flipperInterval = setInterval(() => {
            this.currentIndex = (this.currentIndex + 1) % this.snippets.length;
          }, this.FLIPPER_PERIOD);
        }
      });
  }

  // post treatment of page after loading (sorting, filtering, special titles handling, setting pageTemplate, setting title, etc)
  page_post_handling() {

    switch (this.page_title) {
      case MENU_TITLES.NEWS:
        // NEWS.1 : sort by createdAt desc
        this.snippets = this.snippets.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
        // NEWS.2 : scroll to snippet if snippet_title is provided
        if (this.snippet_title) {
          const snippet = this.snippets.find(s => s.title === this.snippet_title);
          // if (snippet) { this.scrollToElement(snippet.title); }
        }
        this.titleService.setTitle(this.page.title);
        this.pageTemplate = this.page.template;
        break;
      case EXTRA_TITLES.HIGHLIGHTS:
        // HIGHLIGHTS.1: filter "featured" snippets (got from news)  and sort by updatedAt desc
        this.snippets = this.snippets.filter(s => s.featured)
          .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
        // HIGHLIGHTS.2: set pageTemplate to A_LA_UNE
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
            console.log('days', days);
            return days.map(day => {
              const members_in_day = result[day];

              return {
                id: `birthday_snippet_${day}`,
                title: new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit' }),
                content: members_in_day.map(member => `<p>${member.firstname} ${member.lastname}</p>`).join(''),
                subtitle: 'Joyeux anniversaire',
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

  // special DOM event or handling

  // special pour news
  readMore(snippet: Snippet) {
    this.router.navigate(['/front/news', snippet.title]);
  }

  // spécial recalage de la hauteur de l'image sur le texte (mode publication)
  // ngAfterViewInit() {
  //   this.updateTextHeight();
  // }

  // ngAfterViewChecked() {
  //   this.updateTextHeight();
  // }

  // updateTextHeight() {
  //   if (this.textRef && this.textRef.nativeElement) {
  //     const newHeight = this.textRef.nativeElement.offsetHeight;
  //     if (this.textHeight !== newHeight) {
  //       this.textHeight = newHeight;
  //       this.cdr.detectChanges();
  //     }
  //   }
  // }



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


  // scrollToElement(title: string) {
  //   setTimeout(() => {
  //     const element = document.getElementById(title);
  //     if (element) {
  //       element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  //     }
  //   }, 0);
  // }

  // isMobile() {
  //   return window.innerWidth < 576;
  // }

  // nextSnippet() {
  //   if (this.snippets && this.snippets.length > 0) {
  //     this.currentIndex = (this.currentIndex + 1) % this.snippets.length;
  //   }
  // }
  // prevSnippet() {
  //   if (this.snippets && this.snippets.length > 0) {
  //     this.currentIndex = (this.currentIndex - 1 + this.snippets.length) % this.snippets.length;
  //   }
  // }

  isKnownTemplate(template: PAGE_TEMPLATES): boolean {
    return Object.values(PAGE_TEMPLATES).includes(template);
  }

}
