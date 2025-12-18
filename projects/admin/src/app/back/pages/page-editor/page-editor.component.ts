
import { Component, Input, OnChanges, SimpleChanges, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { Page, Snippet, PAGE_TEMPLATES, CLIPBOARD_TITLE } from '../../../common/interfaces/page_snippet.interface';
import { ToastService } from '../../../common/services/toast.service';
import { NgbModule, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { CdkDrag, CdkDropList, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { SnippetEditor } from '../snippet-editor/snippet-editor';
import { GenericPageComponent } from '../../../front/front/pages/generic-page/generic-page.component';
import { ClipboardService } from '../../../common/services/clipboard.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-page-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    SnippetEditor,
    NgbModule,
    CdkDrag,
    CdkDropList,
    GenericPageComponent
  ],
  templateUrl: './page-editor.component.html',
  styleUrl: './page-editor.component.scss'
})
export class PageEditorComponent implements OnChanges {
  @Input() pageId: string = '';
  selected_page!: Page;
  snippets: Snippet[] = [];
  pageSnippets: Snippet[] = [];
  selected_snippet: Snippet | null = null;
  pageForm!: FormGroup;
  pageTemplates = Object.values(PAGE_TEMPLATES);
  addSnippetForm!: FormGroup;
  @ViewChild('addSnippetModal') addSnippetModal: any;
  @ViewChild('clipboardModal') clipboardModal: any;
  clipboardSnippets$!: Observable<Snippet[]>;
  is_clipboard_page: boolean = false;

  constructor(
    private pageService: PageService,
    private snippetService: SnippetService,
    private toastService: ToastService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private clipboardService: ClipboardService) {
    this.pageForm = this.fb.group({
      title: [''],
      template: [PAGE_TEMPLATES.PUBLICATION]
    });
    this.addSnippetForm = this.fb.group({
      title: [''],
      subtitle: ['']
    });
    this.clipboardSnippets$ = this.clipboardService.clipboardSnippets$;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pageId'] && this.pageId) {
      this.selected_snippet = null;
      this.loadPage();
    }
  }


  loadPage(): void {
    const page = this.pageService.getPage(this.pageId);
    if (page) {
      this.selected_page = page;
      this.pageForm.patchValue({
        title: page.title,
        template: page.template
      });
      this.loadSnippets();
      const titleControl = this.pageForm.get('title');
      if (page.title === CLIPBOARD_TITLE) {
        titleControl?.disable({ emitEvent: false });
        this.is_clipboard_page = true;
      } else {
        titleControl?.enable({ emitEvent: false });
        this.is_clipboard_page = false;
      }
    } else {
      this.toastService.showErrorToast('Page', 'Page non trouvée');
      throw new Error('Page not found');
    }
  }


  openAddSnippetModal(): void {
    this.addSnippetForm.reset();
    this.modalService.open(this.addSnippetModal, { centered: true });
  }

  openClipboardModal(): void {
    this.modalService.open(this.clipboardModal, { centered: true });
  }

  // page methods

  get pageTitleForPreview(): any {
    return this.selected_page.title;
  }

  page_row_cols(page: Page): { SM: number; MD: number; LG: number; XL: number } {
    // Define row_cols based on page template
    switch (page.template) {
      case PAGE_TEMPLATES.PUBLICATION:
      case PAGE_TEMPLATES.CARDS_top:
        case PAGE_TEMPLATES.SEQUENTIAL:
        return { SM: 1, MD: 1, LG: 1, XL: 1 };
      default:
        return { SM: 1, MD: 1, LG: 2, XL: 3 };
    }
  }

  async savePage(): Promise<void> {

    const formValue = this.pageForm.value;
    this.selected_page.title = formValue.title;
    this.selected_page.template = formValue.template;

    try {
      await this.pageService.updatePage(this.selected_page);
      this.toastService.showSuccess('Page', 'Page mise à jour');
    } catch (error) {
      this.toastService.showErrorToast('Page', 'Erreur lors de la mise à jour');
    }
  }

  // drag and drop methods

  onDrop(event: any): void {
    if (event.previousContainer === event.container) {
      // Réorganisation locale
      const arr = event.container.data;
      const [removed] = arr.splice(event.previousIndex, 1);
      arr.splice(event.currentIndex, 0, removed);
    } else {
      // Ajout depuis une autre liste (si utilisé)
      const snippet = event.previousContainer.data[event.previousIndex];
      this.pageSnippets.splice(event.currentIndex, 0, snippet);
    }
    this.updatePageSnippets();
  }

  // snippet methods

  selectSnippet(snippet: Snippet): void {
    this.selected_snippet = snippet;
  }


  async addSnippet(modal: NgbModalRef): Promise<void> {
    const { title, subtitle } = this.addSnippetForm.value;
    if (!title) return;
    const newSnippet: Snippet = {
      id: 'snpt_' + Date.now(),
      title,
      subtitle,
      content: '',
      image: '',
      publishedAt: new Date().toISOString(),
      public: true,
      featured: false,
      file: '',
      folder: ''
    };
    try {
      const created = await this.snippetService.createSnippet(newSnippet);
      // this.snippets.push(created);
      this.pageSnippets.push(created);
      await this.updatePageSnippets();
      modal.close();
      this.toastService.showSuccess('Snippet', 'Snippet ajouté');
    } catch (error) {
      this.toastService.showErrorToast('Snippet', 'Erreur lors de la création');
    }
  }
  removeSnippet(snippet: Snippet): void {
    const index = this.pageSnippets.indexOf(snippet);
    if (index > -1) {
      this.pageSnippets.splice(index, 1);
      this.clipboardService.addSnippet(snippet);
      this.updatePageSnippets();
    }
  }

  restoreSnippet(snippet: Snippet, modal?: NgbModalRef | null): void {
    this.pageSnippets.push(snippet);
    this.clipboardService.removeSnippet(snippet.id);
    this.updatePageSnippets();

    modal?.close();
    this.toastService.showSuccess('Snippet', 'Snippet restitué');
  }
  loadSnippets(): void {
    this.snippetService.listSnippets().subscribe(snippets => {
      this.snippets = snippets;
      if (this.selected_page) {
        this.pageSnippets = this.selected_page.snippet_ids
          .map(id => snippets.find(s => s.id === id))
          .filter(s => s !== undefined) as Snippet[];
      }
    });
  }


  trackSnippet(index: number, snippet: Snippet) {
    return snippet.id;
  }

  async updatePageSnippets(): Promise<void> {

    this.selected_page.snippet_ids = this.pageSnippets.map(s => s.id);
    try {
      await this.pageService.updatePage(this.selected_page);
      this.toastService.showSuccess('Page', 'Snippets mis à jour');
    } catch (error) {
      this.toastService.showErrorToast('Page', 'Erreur lors de la mise à jour');
    }
  }


  async deleteSnippet(snippet: Snippet): Promise<void> {
    if (this.selected_page.title !== CLIPBOARD_TITLE) return;
    const index = this.pageSnippets.indexOf(snippet);
    if (index > -1) {
      this.pageSnippets.splice(index, 1);
      this.selected_page.snippet_ids = this.pageSnippets.map(s => s.id);
      await this.pageService.updatePage(this.selected_page);
      await this.snippetService.deleteSnippet(snippet);
      this.toastService.showSuccess('Clipboard', 'Snippet supprimé définitivement');
    }
  }

      // Remplace le snippet modifié par une nouvelle référence pour forcer la détection de changement dans la stack
  onSnippetSaved(updated: Snippet) {
    this.pageSnippets = this.pageSnippets.map(s => s.id === updated.id ? { ...s, ...updated } : s);
  }

  // Handler for snippet-editor saved output: update local lists and active selection
  // onSnippetSaved(updatedSnippet: Snippet) {
  //   if (!updatedSnippet) return;
  //   // update pageSnippets array entry if present — replace with new object and refresh array reference
  //   const idx = this.pageSnippets.findIndex(s => s.id === updatedSnippet.id);
  //   if (idx > -1) {
  //     this.pageSnippets[idx] = { ...updatedSnippet } as Snippet;
  //     this.pageSnippets = this.pageSnippets.slice(); // refresh reference for change detection
  //   }
  //   // also update global snippets list and selected_snippet
  //   const globalIdx = this.snippets.findIndex(s => s.id === updatedSnippet.id);
  //   if (globalIdx > -1) {
  //     this.snippets[globalIdx] = { ...updatedSnippet } as Snippet;
  //     this.snippets = this.snippets.slice();
  //   }
  //   if (this.selected_snippet && this.selected_snippet.id === updatedSnippet.id) {
  //     this.selected_snippet = { ...updatedSnippet };
  //   }
  // }
}
