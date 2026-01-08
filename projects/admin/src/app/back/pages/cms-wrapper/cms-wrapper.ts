import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormsModule } from '@angular/forms';
import { firstValueFrom, Subscription, Observable } from 'rxjs';
import { Page, Snippet, PAGE_TEMPLATES, MENU_TITLES, EXTRA_TITLES, CLIPBOARD_TITLE } from '../../../common/interfaces/page_snippet.interface';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { ClipboardService } from '../../../common/services/clipboard.service';
import { ToastService } from '../../../common/services/toast.service';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { CdkDrag, CdkDropList, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FileManager } from '../../../services/file-manager';
import { FileBrowser } from '../file-browser/file-browser';
import { FileUploader } from '../file-uploader/file-uploader';
import { GenericPageComponent } from '../../../front/front/pages/generic-page/generic-page.component';
import { BreakpointsSettings } from '../../../common/interfaces/ui-conf.interface';
import { SnippetEditor } from '../snippet-editor/snippet-editor';

@Component({
  selector: 'app-cms-wrapper',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    CdkDrag,
    CdkDropList,
    FileBrowser,
    FileUploader,
    GenericPageComponent,
    SnippetEditor
  ],
  templateUrl: './cms-wrapper.html',
  styleUrl: './cms-wrapper.scss'
})
export class CmsWrapper implements OnInit, OnDestroy {
  // Page management
  pages: Page[] = [];
  selectedPage: Page | null = null;
  selectedPageId: string | null = null;
  pageForm!: FormGroup;
  pageTemplates = Object.values(PAGE_TEMPLATES);

  // Snippet management
  pageSnippets: Snippet[] = [];
  openSnippetId: string | null = null;
  clipboardSnippets$!: Observable<Snippet[]>;

  // Modal references
  @ViewChild('clipboardModal') clipboardModal: any;

  // File management state (will be moved to service later)
  fileSelectionMode: boolean = false;
  fileSelectionContext: string = '';
  fileMode: 'browse' | 'upload' = 'browse';

  // File selection management
  private subscriptions: Subscription[] = [];
  activeSelectionSnippetId: string | null = null;

  constructor(
    private pageService: PageService,
    private snippetService: SnippetService,
    private clipboardService: ClipboardService,
    private toastService: ToastService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private fileManager: FileManager
  ) {
    this.initializeForm();
  }

  async ngOnInit(): Promise<void> {
    // load snippets & check snippet.image_url for each snippet with  image
    this.snippetService.listSnippets().subscribe((snippets: Snippet[]) => {
      snippets.forEach(async (snippet) => {
        if (snippet.image) {
          if (!snippet.image_url) {
            this.toastService.showWarning('Vérification des images', ` la vignette de ${snippet.title} est introuvable`);
          }
        }
      });
    });

      this.pageService.listPages().subscribe((pages: Page[]) => {
        this.pages = pages.sort((a, b) => a.title.localeCompare(b.title));
      });

      this.setupFileSelectionListener();
      this.clipboardSnippets$ = this.clipboardService.clipboardSnippets$;
    }

  ngOnDestroy(): void {
      this.subscriptions.forEach(sub => sub.unsubscribe());
    }

  private initializeForm(): void {
      this.pageForm = this.fb.group({
        title: [''],
        template: [PAGE_TEMPLATES.PUBLICATION]
      });
    }


  // === PAGE MANAGEMENT ===

  async openClipboard() {
      this.modalService.open(this.clipboardModal, { size: 'lg' });
    }

  is_Clipboard(page: Page): boolean {
      return page.title === CLIPBOARD_TITLE;
    }



  selectPage(page: Page): void {
      this.selectedPage = page;
      this.selectedPageId = page.id;

      // Clear pageSnippets immediately to prevent showing previous page's snippets
      this.pageSnippets = [];

      // Update form
      this.pageForm.patchValue({
        title: page.title,
        template: page.template || PAGE_TEMPLATES.PUBLICATION
      });

      // Load snippets for this page, ensuring snippet_ids array is clean
      const snippetIds = (page.snippet_ids || []).filter(id => id && typeof id === 'string' && id.trim() !== '');
      this.loadPageSnippets(snippetIds);
    }

  async savePage(): Promise<void> {
    if (!this.selectedPage) return;

    const formValue = this.pageForm.value;
    const updatedPage: Page = {
      ...this.selectedPage,
      title: formValue.title,
      template: formValue.template
    };

    // Update IMMEDIATELY (synchronously) before DB call to prevent warnings
    this.selectedPage = updatedPage;
    const index = this.pages.findIndex(p => p.id === updatedPage.id);
    if (index !== -1) {
      this.pages[index] = updatedPage;
      // Force change detection immediately
      this.pages = [...this.pages];
    }

    // Then persist to DB asynchronously
    try {
      await this.pageService.updatePage(updatedPage);
    } catch (error) {
      this.toastService.showErrorToast('Erreur', 'Impossible de sauvegarder la page');
    }
  }

  async createNewPage() {
    const newPage = {
      title: 'Nouvelle page',
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: []
    };

    try {
      const created = await this.pageService.createPage(newPage);
      if (created) {
        // Ajouter la nouvelle page au tableau
        this.pages.push(created);
        // Trier et forcer change detection AVANT de sélectionner
        this.pages = [...this.pages].sort((a, b) => a.title.localeCompare(b.title));
        // Maintenant sélectionner (après que pages est à jour)
        this.selectPage(created);
        this.toastService.showSuccess('Page', 'Nouvelle page créée');
      }
    } catch (error) {
      this.toastService.showErrorToast('Erreur', 'Impossible de créer la page');
    }
  }

  async deletePage(page: Page): Promise<void> {
    if (!page) return;
    try {
      const confirmed = confirm(`Supprimer la page « ${page.title} » et tous ses articles ?`);
      if (!confirmed) return;

      // Supprimer tous les snippets associés à la page
      if (page.snippet_ids && page.snippet_ids.length > 0) {
        for (const snippetId of page.snippet_ids) {
          try {
            const snippet = await this.snippetService.readSnippet(snippetId);
            await this.snippetService.deleteSnippet(snippet);
          } catch (err) {
            // Erreur lors de la suppression d'un snippet, on continue
          }
        }
      }

      await this.pageService.deletePage(page);
      this.pages = this.pages.filter(p => p.id !== page.id);
      if (this.selectedPageId === page.id) {
        this.selectedPage = null;
        this.selectedPageId = null;
        this.pageSnippets = [];
      }
      this.toastService.showSuccess('Page', 'Page et articles supprimés');
    } catch (error) {
      this.toastService.showErrorToast('Erreur', 'Impossible de supprimer la page ou ses articles');
    }
  }

  // === FILE SELECTION MANAGEMENT ===

  setupFileSelectionListener(): void {
    // Listen to file selections from FileManager
    this.subscriptions.push(
      this.fileManager.fileSelected$.subscribe(selection => {
        if (selection && selection.context && this.activeSelectionSnippetId) {
          this.applyFileSelectionToSnippet(selection as { path: string, type: string, context: string, targetId?: string });
        }
      })
    );
  }

  onFileSelectionRequested(event: { type: 'image' | 'document' | 'folder', snippet: Snippet, context: string }): void {

    this.activeSelectionSnippetId = event.snippet.id;

    // Set the appropriate root folder based on selection type
    const rootFolder = event.type === 'image' ? 'images' :
      event.type === 'document' ? 'documents' :
        'albums';

    // Request file selection through FileManager
    this.fileManager.activateSelectionMode({
      type: event.type,
      context: event.context,
      targetId: event.snippet.id
    });

    // Navigate to the appropriate root folder
    this.fileManager.setCurrentRoot(rootFolder);
  }

  private applyFileSelectionToSnippet(selection: { path: string, type: string, context: string, targetId?: string }): void {

    // Find the target snippet and apply the selection
    const targetSnippetIndex = this.pageSnippets.findIndex(s => s.id === selection.targetId);
    if (targetSnippetIndex === -1) {
      return;
    }

    const targetSnippet = this.pageSnippets[targetSnippetIndex];

    // Create a new snippet object to trigger ngOnChanges in snippet-editor
    const updatedSnippet = { ...targetSnippet };

    // Get the full path including root prefix
    const currentRoot = this.fileManager.getCurrentRoot();
    const fullPath = currentRoot + selection.path;

    // Update the snippet object based on selection type
    if (selection.type === 'image') {
      updatedSnippet.image = fullPath;
    } else if (selection.type === 'document') {
      updatedSnippet.file = fullPath;
    } else if (selection.type === 'folder') {
      updatedSnippet.folder = fullPath;
    }

    // Update the array with the new snippet instance to trigger change detection
    if (targetSnippetIndex !== -1) {
      this.pageSnippets[targetSnippetIndex] = updatedSnippet;
      this.pageSnippets = this.pageSnippets.slice(); // trigger change detection
    }


    // Reset active selection
    this.activeSelectionSnippetId = null;
  }

  // todo : est-ce vraiment utile de faire ça de cette façon ?
  async loadPageSnippets(snippetIds: string[]): Promise<void> {
    if (!snippetIds || snippetIds.length === 0) {
      this.pageSnippets = [];
      return;
    }

    try {
      this.pageSnippets = snippetIds
        .map(id => this.snippetService.getSnippet(id))
        .filter((s): s is Snippet => !!s && !!s.id);
    } catch (error) {
      this.pageSnippets = [];
    }
  }

  // === SNIPPET MANAGEMENT ===

  async addNewSnippet(): Promise<void> {
    if (!this.selectedPage) return;

    // Format date as yyyy-MM-dd for HTML date input
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const publishedAt = `${yyyy}-${mm}-${dd}`;

    const newSnippet: Snippet = {
      id: 'snpt_' + Date.now(),
      title: 'Nouvel article',
      subtitle: '',
      content: '',
      image: '',
      publishedAt: publishedAt,
      public: true,
      featured: false,
      file: '',
      folder: ''
    };

    try {
      const created = await this.snippetService.createSnippet(newSnippet);
      if (created) {
        // Update UI IMMEDIATELY (synchronously) before DB calls
        
        // Add the new snippet to the array (check for duplicates)
        const existingIndex = this.pageSnippets.findIndex(s => s.id === created.id);
        if (existingIndex === -1) {
          this.pageSnippets = [...this.pageSnippets, created];
        }

        // Update page snippet_ids if not already present
        if (!this.selectedPage.snippet_ids.includes(created.id)) {
          this.selectedPage.snippet_ids = [...this.selectedPage.snippet_ids, created.id];
        }

        // Update local pages array immediately
        const pageIndex = this.pages.findIndex(p => p.id === this.selectedPage!.id);
        if (pageIndex !== -1) {
          this.pages[pageIndex] = { ...this.selectedPage };
          this.pages = [...this.pages]; // Force change detection
        }
        
        this.openSnippetId = created.id;

        // Then persist page to DB asynchronously
        try {
          await this.pageService.updatePage(this.selectedPage);
          this.toastService.showSuccess('Article', 'Nouvel article créé');
        } catch (dbError) {
          this.toastService.showWarning('Article créé', 'Erreur lors de la mise à jour de la page');
        }
      }
    } catch (error) {
      this.toastService.showErrorToast('Erreur', 'Impossible de créer l\'article');
    }
  }

  onSnippetAccordionClick(snippet: Snippet): void {
    this.openSnippetId = this.openSnippetId === snippet.id ? null : snippet.id;
  }

  async onSnippetSaved(snippet: Snippet): Promise<void> {
    // Update UI IMMEDIATELY (synchronously) before DB call
    const index = this.pageSnippets.findIndex(s => s.id === snippet.id);
    if (index !== -1) {
      this.pageSnippets[index] = snippet;
      this.pageSnippets = [...this.pageSnippets]; // Force change detection
    }

    // Then persist to DB asynchronously
    try {
      await this.snippetService.updateSnippet(snippet);
    } catch (error) {
      this.toastService.showErrorToast('Erreur', 'Impossible de sauvegarder l\'article');
      // On error, could reload snippets to revert local changes
    }
  }

  deleteSnippetFromCurrentPage(snippet: Snippet ): void {
    const confirmed = confirm(`Supprimer le snippet « ${snippet.title} » ?`);
    if (!confirmed) return;

    this.snippetService.deleteSnippet(snippet).then(async () => {
      // Remove from local pageSnippets array
      this.pageSnippets = this.pageSnippets.filter(s => s.id !== snippet.id);
      // Also remove from selectedPage's snippet_ids
      this.selectedPage!.snippet_ids = this.selectedPage!.snippet_ids.filter(id => id !== snippet.id);

      await this.pageService.updatePage(this.selectedPage!);
      this.toastService.showSuccess('Article', 'Article supprimé');
    }).catch(() => {
      this.toastService.showErrorToast('Erreur', 'Impossible de supprimer l\'article');
    });
  }


  // === DRAG & DROP METHODS ===

  onDrop(event: CdkDragDrop<Snippet[]>): void {
    if (event.previousContainer === event.container) {
      // Réorganisation locale
      moveItemInArray(this.pageSnippets, event.previousIndex, event.currentIndex);
      this.updatePageSnippetOrder();
    }
  }

  async updatePageSnippetOrder(): Promise<void> {
    if (this.selectedPage) {
      this.selectedPage.snippet_ids = this.pageSnippets.map(s => s.id);
      try {
        await this.pageService.updatePage(this.selectedPage);
      } catch (error) {
        this.toastService.showErrorToast('Erreur', 'Impossible de sauvegarder l\'ordre des articles');
      }
    }
  }

  // === CLIPBOARD METHODS ===

  async moveSnippetToClipboard(snippet: Snippet): Promise<void> {
    const index = this.pageSnippets.findIndex(s => s.id === snippet.id);
    if (index > -1 && this.selectedPage) {
      // Retirer de la page courante
      const newSnippets = this.pageSnippets.filter(s => s.id !== snippet.id);
      this.pageSnippets = newSnippets; // Use setter for safety
      this.selectedPage.snippet_ids = this.pageSnippets.map(s => s.id);
      await this.pageService.updatePage(this.selectedPage);

      // Ajouter au clipboard
      await this.clipboardService.addSnippet(snippet);

      this.toastService.showSuccess('Article', 'Article déplacé vers le presse-papiers');
    }
  }

  async restoreSnippetFromClipboard(snippet: Snippet, modal?: NgbModalRef): Promise<void> {
    if (!this.selectedPage) return;

    // Use setter to safely add the snippet with deduplication
    this.pageSnippets = [...this.pageSnippets, snippet];
    this.selectedPage.snippet_ids.push(snippet.id);

    await this.clipboardService.removeSnippet(snippet.id);
    await this.pageService.updatePage(this.selectedPage);

    modal?.close();
    this.toastService.showSuccess('Article', 'Article restitué depuis le presse-papiers');
  }

  // === PREVIEW METHODS ===

  getPageRowCols(page: Page | null | undefined): BreakpointsSettings {
    // Define row_cols based on page template
    if (!page || !page.template) {
      return { SM: 1, MD: 1, LG: 2, XL: 3 };
    }

    switch (page.template) {
      case PAGE_TEMPLATES.PUBLICATION:
      case PAGE_TEMPLATES.CARDS_top:
      case PAGE_TEMPLATES.SEQUENTIAL:
        return { SM: 1, MD: 1, LG: 1, XL: 1 };
      default:
        return { SM: 1, MD: 1, LG: 2, XL: 3 };
    }
  }

  // === FILE MANAGEMENT ===
  // These methods will be moved to a service later

  onFileModeChange(mode: 'browse' | 'upload') {
    // If switching to upload mode, cancel any active selection mode
    if (mode === 'upload' && this.fileMode === 'browse') {
      this.fileManager.cancelSelectionMode();
    }
    this.fileMode = mode;
  }

  activateFileSelection(type: 'image' | 'document' | 'folder', snippet: Snippet, context: string): void {
    this.fileSelectionMode = true;
    this.fileSelectionContext = context;
  }

  cancelFileSelection(): void {
    this.fileSelectionMode = false;
    this.fileSelectionContext = '';
  }
}
