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

  ngOnInit(): void {
    this.loadPages();
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

  async loadPages(): Promise<void> {
    this.pageService.listPages().subscribe((pages: Page[]) => {
      this.pages = pages;
    });
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

    // Special handling for CLIPBOARD - potential source of duplication bugs
    // if (page.title === CLIPBOARD_TITLE) {
    //   console.warn('⚠️ CLIPBOARD detected - watch for duplication issues');
    //   // Don't use loadPageSnippets for clipboard, use the clipboard service directly
    //   return;
    // }

    this.loadPageSnippets(snippetIds);
  }

  async savePage(): Promise<void> {
    if (!this.selectedPage) return;

    const formValue = this.pageForm.value;
    const updatedPage = {
      ...this.selectedPage,
      title: formValue.title,
      template: formValue.template
    };

    try {
      await this.pageService.updatePage(updatedPage);
      this.selectedPage = updatedPage;

      // Update in local pages array
      const index = this.pages.findIndex(p => p.id === updatedPage.id);
      if (index !== -1) {
        this.pages[index] = updatedPage;
      }
    } catch (error) {
      // Error saving page - could add user notification here
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

    // Wait a bit for UI to update then trigger a save to persist the change
    setTimeout(() => {
      this.onSnippetSaved(updatedSnippet);
    }, 100);

    // Reset active selection
    this.activeSelectionSnippetId = null;
  }

  async loadPageSnippets(snippetIds: string[]): Promise<void> {
    if (!snippetIds || snippetIds.length === 0) {
      this.pageSnippets = [];
      return;
    }

    // Filter out null/undefined/empty snippet IDs upfront and remove duplicates
    const validSnippetIds = [...new Set(snippetIds.filter(id => id && typeof id === 'string' && id.trim() !== ''))];

    // Log if we found duplicate IDs in the page configuration
    if (validSnippetIds.length !== snippetIds.length) {
      console.warn('🔍 DUPLICATE SNIPPET IDs FOUND IN PAGE CONFIG:', {
        originalIds: snippetIds,
        dedupedIds: validSnippetIds,
        duplicatesCount: snippetIds.length - validSnippetIds.length
      });
    }

    if (validSnippetIds.length === 0) {
      this.pageSnippets = [];
      return;
    }

    try {
      // First ensure all snippets are loaded
      await firstValueFrom(this.snippetService.listSnippets());

      // Map to snippets and filter out null/undefined results
      const snippetsMap = new Map<string, Snippet>();
      validSnippetIds.forEach(id => {
        const snippet = this.snippetService.getSnippet(id);
        if (snippet !== null && snippet !== undefined && snippet.id !== undefined && snippet.id !== null) {
          snippetsMap.set(snippet.id, snippet);
        }
      });

      // Convert map back to array to preserve order and ensure uniqueness
      const cleanSnippets = Array.from(snippetsMap.values());
      this.pageSnippets = cleanSnippets; // This will use our setter with deduplication

      // Simple check - should never have duplicates now
      if (this.pageSnippets.length !== cleanSnippets.length) {
        console.error('🚨 CLIPBOARD BUG: Duplicate snippet IDs were found and removed');
      }

    } catch (error) {
      console.error('Error loading page snippets:', error);
      this.pageSnippets = []; // This will use our setter
    }
  }

  async addNewSnippet(): Promise<void> {
    if (!this.selectedPage) return;

    const newSnippet: Snippet = {
      id: 'snpt_' + Date.now(),
      title: 'Nouvel article',
      subtitle: '',
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
      if (created) {
        // Check if snippet already exists to avoid duplicates
        const existingIndex = this.pageSnippets.findIndex(s => s.id === created.id);
        if (existingIndex === -1) {
          // Use setter to safely add the new snippet with deduplication
          this.pageSnippets = [...this.pageSnippets, created];
        }

        if (!this.selectedPage.snippet_ids.includes(created.id)) {
          this.selectedPage.snippet_ids.push(created.id);
        }

        await this.pageService.updatePage(this.selectedPage);
        this.openSnippetId = created.id;
        this.toastService.showSuccess('Article', 'Nouvel article créé');
      }
    } catch (error) {
      this.toastService.showErrorToast('Erreur', 'Impossible de créer l\'article');
    }
  }

  onSnippetAccordionClick(snippet: Snippet): void {
    this.openSnippetId = this.openSnippetId === snippet.id ? null : snippet.id;
  }

  async onSnippetSaved(snippet: Snippet): Promise<void> {

    try {
      // Save to database via snippetService
      const savedSnippet = await this.snippetService.updateSnippet(snippet);

      // Update the snippet in the local array with the saved version
      const index = this.pageSnippets.findIndex(s => s.id === snippet.id);
      if (index !== -1) {
        this.pageSnippets[index] = savedSnippet;
        this.pageSnippets = this.pageSnippets.slice(); // trigger change detection
      }
    } catch (error) {
      // Error saving snippet - could add user notification
    }
  }

  // Removed trackSnippet function - now using snippet.id directly in template

  async openClipboard() {
    this.modalService.open(this.clipboardModal, { size: 'lg' });
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

  get pageTitleForPreview(): MENU_TITLES | EXTRA_TITLES {
    // Convert the page title to a MENU_TITLES or EXTRA_TITLES enum value
    const title = this.selectedPage?.title;
    if (!title) return MENU_TITLES.NEWS; // Default fallback

    // Try to find matching enum value
    const menuTitles = Object.values(MENU_TITLES) as string[];
    const extraTitles = Object.values(EXTRA_TITLES) as string[];

    if (menuTitles.includes(title)) {
      return title as MENU_TITLES;
    } else if (extraTitles.includes(title)) {
      return title as EXTRA_TITLES;
    }

    // Default fallback
    return MENU_TITLES.NEWS;
  }

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
