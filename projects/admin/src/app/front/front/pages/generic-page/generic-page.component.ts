import { Component, Input, Renderer2, ElementRef, OnChanges, SimpleChanges, OnInit, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { map, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EXTRA_TITLES, MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../../common/interfaces/page_snippet.interface';
import { FileService } from '../../../../common/services/files.service';
import { PageService } from '../../../../common/services/page.service';
import { SnippetService } from '../../../../common/services/snippet.service';
import { ToastService } from '../../../../common/services/toast.service';
import { AlbumComponent } from '../../../album/album.component';
import { TitleService } from '../../../title/title.service';
import { TruncatePipe } from '../../../../common/pipes/truncate.pipe';
import { NgbDropdownModule, NgbModule, NgbTooltipModule } from "@ng-bootstrap/ng-bootstrap";

@Component({
  selector: 'app-generic-page',
  imports: [CommonModule, AlbumComponent, TruncatePipe, NgbModule, NgbTooltipModule, NgbDropdownModule],
  templateUrl: './generic-page.component.html',
  styleUrl: './generic-page.component.scss'
})
export class GenericPageComponent implements OnInit, OnChanges {
  @ViewChild('textRef', { static: false }) textRef!: ElementRef;
  textHeight: number = 0;


  @Input() menu_title!: MENU_TITLES | EXTRA_TITLES;
  @Input() snippet_title?: string; // for news, the title of the selected snippet
  page!: Page;
  pageTemplate!: PAGE_TEMPLATES;
  PAGE_TEMPLATES = PAGE_TEMPLATES;
  snippets: Snippet[] = [];

  TRUNCATE_LIMIT = 300; //  truncating news content
  TRUNCATE_HYSTERISIS = 50; // threshold to show "Read more" link

  // def for documents
  icons: { [key: string]: string } = {
    pdf: 'bi-file-earmark-pdf-fill',
    word: 'bi-file-earmark-word-fill',
    excel: 'bi-file-earmark-excel-fill',
    powerpoint: 'bi-file-earmark-powerpoint-fill',
    unknown: 'bi-file-earmark-fill'
  };

  constructor(
    private snippetService: SnippetService,
    private pageService: PageService,
    private titleService: TitleService,
    private toastService: ToastService,
    private fileService: FileService,
    private router: Router,
    private renderer: Renderer2,
    private el: ElementRef,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['menu_title'] && changes['menu_title'].currentValue) {
      this.menu_title = changes['menu_title'].currentValue;
      this.snippet_title = changes['snippet_title']?.currentValue ? changes['snippet_title'].currentValue : null;
      this.loadPageAndSnippets();
    }
  }
  ngOnInit(): void {
    this.init_relative_links_handler();
    this.loadPageAndSnippets();
  }


  // spécial recalage de la hauteur de l'image sur le texte (mode publication)
    ngAfterViewInit() {
    this.updateTextHeight();
  }

  ngAfterViewChecked() {
    this.updateTextHeight();
  }

  updateTextHeight() {
    if (this.textRef && this.textRef.nativeElement) {
      const newHeight = this.textRef.nativeElement.offsetHeight;
      if (this.textHeight !== newHeight) {
        this.textHeight = newHeight;
        this.cdr.detectChanges();
      }
    }
  }

  loadPageAndSnippets() {

    this.pageService.getPageByTitle(((this.menu_title === EXTRA_TITLES.HIGHLIGHTS) ? MENU_TITLES.NEWS : this.menu_title)).pipe(
      map(page => {
        if (!page) { throw new Error(this.menu_title + ' page not found') }
        this.page = page;
      }),
      switchMap(() => this.snippetService.listSnippets())
    )
      .subscribe((snippets) => {
        // get the snippets for this page
        this.snippets = this.page.snippet_ids
          .map(id => snippets.find(snippet => snippet.id === id))  // check for correct loading of  page's snippets
          .filter(snippet => snippet !== undefined) as Snippet[];  // filter out undefined values

        this.page_post_handling();
      });
  }

  // special pour news
  readMore(snippet: Snippet) {
    this.router.navigate(['/front/news', snippet.title]);
  }

  page_post_handling() {

    switch (this.menu_title) {
      case MENU_TITLES.NEWS:
        // NEWS.1 : sort by createdAt desc
        this.snippets = this.snippets.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
        // NEWS.2 : scroll to snippet if snippet_title is provided
        if (this.snippet_title) {
          const snippet = this.snippets.find(s => s.title === this.snippet_title);
          if (snippet) { this.scrollToElement(snippet.title); }
        }
        this.titleService.setTitle(this.page.title );
        this.pageTemplate = this.page.template ;
        break;
      case EXTRA_TITLES.HIGHLIGHTS:
        // HIGHLIGHTS.1: filter "featured" snippets (got from news)  and sort by updatedAt desc
        this.snippets = this.snippets.filter(s => s.featured)
          .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
        // HIGHLIGHTS.2: set pageTemplate to A_LA_UNE
        this.pageTemplate = PAGE_TEMPLATES.A_LA_UNE;
        break;
      default:
        this.titleService.setTitle(this.page.title );
        this.pageTemplate = this.page.template ;
        break;
    }

  }




  doc_icon(file: string): string {
    const fileType = file.split('.').pop() || '';
    const icon = Object.keys(this.icons).find(key => key === fileType);
    return icon ? this.icons[icon] : this.icons['unknown'];
  }
  async downloadDocument(snippet: Snippet) {
    const docItem = { name: snippet.title, url: snippet.file };
    try {
      const blob = await this.fileService.downloadBlob(docItem.url);
      const a = window.document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = docItem.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(a.href);
       this.toastService.showSuccess('Documents', docItem.name + ' a bien été téléchargé');
    } catch (error) {
      this.toastService.showErrorToast('Erreur lors du téléchargement', docItem.name + ' n\'est pas disponible');
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


  scrollToElement(title: string) {
    setTimeout(() => {
      const element = document.getElementById(title);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

  isMobile() {
    return window.innerWidth < 576;
  }


}
