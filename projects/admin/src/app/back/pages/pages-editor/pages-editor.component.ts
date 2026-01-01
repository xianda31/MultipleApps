
import { Component } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetConfirmationComponent } from '../../../common/modals/get-confirmation.component';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { CLIPBOARD_TITLE, Page, PAGE_TEMPLATES } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '../../../common/services/toast.service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { PageEditorComponent } from '../page-editor/page-editor.component';
import { ClipboardService } from '../../../common/services/clipboard.service';


@Component({
  selector: 'app-pages-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule, PageEditorComponent],
  templateUrl: './pages-editor.component.html',
  styleUrl: './pages-editor.component.scss'
})
export class PagesEditorComponent {

  pages: Page[] = [];
  pagesForm !: FormGroup;
  pageTemplates = Object.values(PAGE_TEMPLATES);
  selected_page: Page | null = null;

  constructor(
    private pageService: PageService,
    private clipboardService: ClipboardService,
    private snippetService: SnippetService,
    private fb: FormBuilder,
    private toastService: ToastService,
    private modalService: NgbModal
  ) {
    this.pagesForm = this.fb.group({
      pagesArray: this.fb.array([])   // pour eviter les erreurs DOM à l'initialisation
    });
  }


  ngOnInit(): void {

    this.pageService.listPages().subscribe((pages) => {
      this.pages = pages.sort((a, b) => a.title.localeCompare(b.title));
      // force bin_page to be the last page
      const binPage = this.pages.find(page => page.title === CLIPBOARD_TITLE);
      if (binPage) {
        this.pages = this.pages.filter(page => page !== binPage).concat(binPage);
      }else{
        this.clipboardService.initClipboardPage();
      }
      this.initFormArray(this.pages);
    });
  }

  selectPage(page: Page) {
    this.selected_page = page
  }

  is_clipboard_page(): boolean {
    return this.selected_page?.title === CLIPBOARD_TITLE;
  }

  async newPage() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newPage: Page = {
      id: '',
      title: `Nouvelle page ${timeStr}`,
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: [],
      snippets: []
    };
    try {
      const created = await this.pageService.createPage(newPage);
      this.selected_page = created;
      this.toastService.showSuccess('Pages', 'Nouvelle page créée');
    } catch (error) {
      this.toastService.showErrorToast('Pages', 'Erreur lors de la création de la page');
    }
  }


  async deletePage(page: Page) {
    if (!page.id) return;
    const modalRef = this.modalService.open(GetConfirmationComponent, { centered: true });
    modalRef.componentInstance.title = 'Supprimer la page ?';
    modalRef.componentInstance.subtitle = `La page « ${page.title} » et tous ses contenus seront supprimés.`;
    try {
      const confirmed = await modalRef.result;
      if (!confirmed) return;
    } catch {
      return;
    }
    const snippets_to_delete = page.snippets || [];
    try {
      await this.pageService.deletePage(page);
      this.toastService.showSuccess('Pages', 'Page supprimée');
      // delete associated snippets
      for (const snippet of snippets_to_delete) {
        await this.snippetService.deleteSnippet(snippet);
        console.log('Snippet deleted:', snippet.title);
      }
      this.selected_page = null;
    } catch (error) {
      this.toastService.showErrorToast('Pages', 'Erreur lors de la suppression de la page');
    }
  }



  initFormArray(pages: Page[]): void {
    this.pagesForm = this.fb.group({
      pagesArray: this.fb.array(pages.map(page => this.fb.group({
        id: [page.id],
        title: [page.title],
        template: [page.template],
        snippet_ids: [page.snippet_ids || []],
        snippets: [page.snippets || []]
      })))
    });
  }


}
