import { Component, Input } from '@angular/core';
import { MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { SnippetService } from '../../../common/services/snippet.service';
import { TitleService } from '../../title.service';
import { CommonModule } from '@angular/common';
import { PageService } from '../../../common/services/page.service';
import { map, switchMap } from 'rxjs';
import { ToastService } from '../../../common/services/toast.service';
import { FileService } from '../../../common/services/files.service';

@Component({
  selector: 'app-generic-page',
  imports: [CommonModule],
  templateUrl: './generic-page.component.html',
  styleUrl: './generic-page.component.scss'
})
export class GenericPageComponent {
  @Input() menu_title!: MENU_TITLES;
  page!: Page;
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
    private fileService: FileService
  ) { }

  ngOnInit(): void {

    
    this.pageService.getPageByTitle(this.menu_title).pipe(
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
}
