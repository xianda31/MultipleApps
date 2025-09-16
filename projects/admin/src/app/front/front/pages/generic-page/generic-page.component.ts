import { Component, Input, Renderer2, ElementRef, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { map, switchMap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {  EXTRA_TITLES, MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../../common/interfaces/page_snippet.interface';
import { FileService } from '../../../../common/services/files.service';
import { PageService } from '../../../../common/services/page.service';
import { SnippetService } from '../../../../common/services/snippet.service';
import { ToastService } from '../../../../common/services/toast.service';
import { AlbumComponent } from '../../../album/album.component';
import { TitleService } from '../../../title/title.service';
import { TruncatePipe } from '../../../../common/pipes/truncate.pipe';

@Component({
  selector: 'app-generic-page',
  imports: [CommonModule, AlbumComponent, TruncatePipe],
  templateUrl: './generic-page.component.html',
  styleUrl: './generic-page.component.scss'
})
export class GenericPageComponent implements OnInit,OnChanges{
  @Input() menu_title!: MENU_TITLES | EXTRA_TITLES;
  page!: Page;
  pageTemplate!: PAGE_TEMPLATES;
  PAGE_TEMPLATES = PAGE_TEMPLATES;
  snippets: Snippet[] = [];


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
    private route: ActivatedRoute,
    private renderer: Renderer2,
    private el: ElementRef
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
   if (changes['menu_title'] && changes['menu_title'].currentValue) {
     this.menu_title = changes['menu_title'].currentValue;
     this.loadPageAndSnippets();
   }
 }
  ngOnInit(): void {
   this.init_relative_links_handler();
   this.loadPageAndSnippets();
  }
  
  loadPageAndSnippets() {

    this.pageService.getPageByTitle(((this.menu_title === EXTRA_TITLES.HIGHLIGHTS) ? MENU_TITLES.NEWS : this.menu_title)).pipe(
       map(page => {
          if (!page) { throw new Error(this.menu_title + ' page not found' ) }
          this.page = page;
          this.titleService.setTitle(this.page.title);
        }),
        switchMap(() => this.snippetService.listSnippets())
      )
      .subscribe((snippets) => {
        this.snippets = this.page.snippet_ids.map(id => snippets.find(snippet => snippet.id === id))
        .filter(snippet => snippet !== undefined) as Snippet[];
        this.pageTemplate = this.page.template as PAGE_TEMPLATES;
        this.special_handling();
      });
  }

  // special pour news
  readMore(snippet: Snippet) {
    this.router.navigate(['/front/news', snippet.title]);
  }

  // special for news
special_handling() {

  if(this.menu_title === EXTRA_TITLES.HIGHLIGHTS) {
    this.snippets = this.snippets.filter(s => s.featured)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    this.pageTemplate = PAGE_TEMPLATES.A_LA_UNE;
  }
  
  if(this.menu_title === MENU_TITLES.NEWS && this.snippets.length > 0) {
    const title = this.route.snapshot.paramMap.get('title');
    if(title) {
      const snippet = this.snippets.find(s => s.title === title);
      if (snippet) {
        console.log('Scrolling to snippet with title:', title, snippet.title);
        this.scrollToElement(snippet.title);
      }
    }
  }
}

  
  // special for documents
  
  
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
