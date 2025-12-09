import { Component, Input, OnChanges, SimpleChanges, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { Page, Snippet, PAGE_TEMPLATES } from '../../../common/interfaces/page_snippet.interface';
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
  @Input() pageId?: string;
  page: Page | null = null;
  snippets: Snippet[] = [];
  pageSnippets: Snippet[] = [];
  selected_snippet: Snippet | null = null;
  pageForm!: FormGroup;
  pageTemplates = Object.values(PAGE_TEMPLATES);
  addSnippetForm!: FormGroup;
  @ViewChild('addSnippetModal') addSnippetModal: any;
  @ViewChild('clipboardModal') clipboardModal: any;
  clipboardSnippets$!: Observable<Snippet[]>;


  constructor(
    private pageService: PageService,
    private snippetService: SnippetService,
    private toastService: ToastService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private clipboardService: ClipboardService,
    private cdr: ChangeDetectorRef
  ) {
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


  get pageTitleForPreview(): any {
    return this.page?.title;
  }

  openAddSnippetModal(): void {
    this.addSnippetForm.reset();
    this.modalService.open(this.addSnippetModal, { centered: true });
  }

  openClipboardModal(): void {
    this.modalService.open(this.clipboardModal, { centered: true });
  }

  async addSnippet(modal: NgbModalRef): Promise<void> {
    if (!this.page) return;
    const { title, subtitle } = this.addSnippetForm.value;
    if (!title) return;
    const newSnippet: Snippet = {
      id: 'snpt_' + Date.now(),
      title,
      subtitle,
      content: '',
      image: '',
      publishedAt: new Date().toISOString(),
      public: false,
      featured: false,
      file: '',
      folder: ''
    };
    try {
      const created = await this.snippetService.createSnippet(newSnippet);
      this.snippets.push(created);
      this.pageSnippets.push(created);
      await this.updatePageSnippets();
      modal.close();
      this.toastService.showSuccess('Snippet', 'Snippet ajouté');
    } catch (error) {
      this.toastService.showErrorToast('Snippet', 'Erreur lors de la création');
    }
  }

  async updatePageSnippets(): Promise<void> {
    if (!this.page) return;

    this.page.snippet_ids = this.pageSnippets.map(s => s.id);
    try {
      await this.pageService.updatePage(this.page);
      this.toastService.showSuccess('Page', 'Snippets mis à jour');
    } catch (error) {
      this.toastService.showErrorToast('Page', 'Erreur lors de la mise à jour');
    }
  }

  async savePage(): Promise<void> {
    if (!this.page) return;

    const formValue = this.pageForm.value;
    this.page.title = formValue.title;
    this.page.template = formValue.template;

    try {
      await this.pageService.updatePage(this.page);
      this.toastService.showSuccess('Page', 'Page mise à jour');
    } catch (error) {
      this.toastService.showErrorToast('Page', 'Erreur lors de la mise à jour');
    }
  }

  selectSnippet(snippet: Snippet): void {
    this.selected_snippet = snippet;
  }

  onDrop(event: any): void {
    if (!this.page) return;
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

  removeSnippet(snippet: Snippet): void {
    const index = this.pageSnippets.indexOf(snippet);
    if (index > -1) {
      this.pageSnippets.splice(index, 1);
      this.clipboardService.addSnippet(snippet);
      this.updatePageSnippets();
    }
  }

  restoreSnippet(snippet: Snippet, modal: any): void {
    this.pageSnippets.push(snippet);
    this.clipboardService.removeSnippet(snippet.id);
    this.updatePageSnippets();
    if (modal && typeof modal.close === 'function') modal.close();
    this.toastService.showSuccess('Snippet', 'Snippet restitué');
  }
  loadSnippets(): void {
    this.snippetService.listSnippets().subscribe(snippets => {
      this.snippets = snippets;
      if (this.page) {
        this.pageSnippets = this.page.snippet_ids
          .map(id => snippets.find(s => s.id === id))
          .filter(s => s !== undefined) as Snippet[];
        // clipboardSnippets est maintenant géré par ClipboardService
      }
    });
  }
  loadPage(): void {
    if (!this.pageId) {
      this.page = null;
      return;
    }
    const page = this.pageService.getPage(this.pageId);
    if (page) {
      this.page = page;
      this.pageForm.patchValue({
        title: page.title,
        template: page.template
      });
      this.loadSnippets();
    }
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pageId'] && this.pageId) {
      this.loadPage();
    }
  }

  trackSnippet(index: number, snippet: Snippet) {
    return snippet.id;
  }

  async deleteSnippet(snippet: Snippet): Promise<void> {
    if (!this.page || this.page.title !== '__CLIPBOARD__') return;
    const index = this.pageSnippets.indexOf(snippet);
    if (index > -1) {
      this.pageSnippets.splice(index, 1);
      this.page.snippet_ids = this.pageSnippets.map(s => s.id);
      await this.pageService.updatePage(this.page);
      await this.snippetService.deleteSnippet(snippet);
      this.toastService.showSuccess('Clipboard', 'Snippet supprimé définitivement');
    }
  }
}
