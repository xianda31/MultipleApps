import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormsModule } from '@angular/forms';
import { combineLatest, firstValueFrom, Subscription, Observable } from 'rxjs';
import { Page, Snippet, PAGE_TEMPLATES, CLIPBOARD_TITLE } from '../../../common/interfaces/page_snippet.interface';
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
import { NavItemsService } from '../../../common/services/navitem.service';
import { FileService } from '../../../common/services/files.service';
import { snippetMissingFields } from '../snippet-editor/snippet-template-rules';
import { CmsImageProfile, cmsImageSourcePrefix, cmsImageTargetDescription, cmsImageVariantPath, imageProfileForTemplate } from '../../../common/images/cms-image-profiles';
import { CMS_IMAGE_PROFILES } from '../../../common/images/cms-image-profiles';
import { CmsImageReview } from '../../../common/images/cms-image-review/cms-image-review';

type CmsWorkspaceTab = 'content' | 'preview' | 'settings';
type MediaSelection = { path: string, type: string, context: string, targetId?: string };

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
    SnippetEditor,
    CmsImageReview,
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
  @ViewChild('mediaModal') mediaModal: any;

  // File management state (will be moved to service later)
  fileSelectionMode: boolean = false;
  fileSelectionContext: string = '';
  fileMode: 'browse' | 'upload' = 'browse';
  workspaceTab: CmsWorkspaceTab = 'content';
  pagePickerOpen = true;
  linkedPageIds = new Set<string>();
  mediaTargetPath = '';
  mediaRoot = 'images';
  mediaSelectionType: 'image' | 'document' | 'folder' | null = null;
  mediaImageProfile: CmsImageProfile | null = null;
  mediaImporting = false;
  mediaPreviewLoading = false;
  mediaPreviewUrl: string | null = null;
    mediaSourceWidth: number | null = null;
    mediaSourceHeight: number | null = null;
    mediaSourceSize: number | null = null;
  private pendingMediaSelection: MediaSelection | null = null;
  private pendingMediaBlob: Blob | null = null;
  private mediaModalRef: NgbModalRef | null = null;

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
    private fileManager: FileManager,
    private fileService: FileService,
    private navItemsService: NavItemsService
  ) {
    this.initializeForm();
  }

  async ngOnInit(): Promise<void> {
    // load snippets & check snippet.image_url for each snippet with image
    this.snippetService.listSnippets().subscribe(async (snippets: Snippet[]) => {
      for (const snippet of snippets) {
        if (snippet.image) {
          if (!snippet.image_url) {
            this.toastService.showWarning('Vérification des images', ` la vignette de ${snippet.title} est introuvable`);
          }
        }
      }
    });

    this.pageService.listPages().subscribe((pages: Page[]) => {
      this.pages = pages.sort((a, b) => a.title.localeCompare(b.title));
    });

    combineLatest([
      this.navItemsService.loadNavItemsSandbox(),
      this.navItemsService.loadNavItemsProduction(),
    ]).subscribe(([sandboxItems, productionItems]) => {
      this.linkedPageIds = new Set(
        [...sandboxItems, ...productionItems].flatMap(item => item.page_id ? [item.page_id] : [])
      );
    });

    this.setupFileSelectionListener();
    this.clipboardSnippets$ = this.clipboardService.clipboardSnippets$;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.mediaModalRef) this.closeMediaModal();
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



  async selectPage(page: Page): Promise<void> {
    this.selectedPage = page;
    this.selectedPageId = page.id;
    this.openSnippetId = null;
    this.pagePickerOpen = false;
    this.workspaceTab = 'content';

    // Clear pageSnippets immediately to prevent showing previous page's snippets
    this.pageSnippets = [];

    // Update form
    this.pageForm.patchValue({
      title: page.title,
      template: page.template || PAGE_TEMPLATES.PUBLICATION
    });

    // Load snippets for this page, ensuring snippet_ids array is clean
    const snippetIds = (page.snippet_ids || []).filter(id => id && typeof id === 'string' && id.trim() !== '');
    
    if (!snippetIds || snippetIds.length === 0) {
      this.pageSnippets = [];
      return;
    }

    try {
      // Charge chaque snippet depuis le backend pour garantir la fraîcheur
      const snippetPromises = snippetIds.map(id => this.snippetService.readSnippet(id).catch(() => undefined));
      const snippets = await Promise.all(snippetPromises);
      this.pageSnippets = snippets.filter((s): s is Snippet => !!s && !!s.id);
    } catch (error) {
      this.pageSnippets = [];
    }
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
      this.toastService.showError('Erreur', 'Impossible de sauvegarder la page');
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
      this.toastService.showError('Erreur', 'Impossible de créer la page');
    }
  }

  async deletePage(page: Page): Promise<void> {
    if (!page) return;
    try {
      const confirmed = confirm(`Supprimer la page « ${page.title} » ? Ses articles seront conservés dans le presse-papiers.`);
      if (!confirmed) return;

      const snippets = await Promise.all(
        (page.snippet_ids ?? []).map(snippetId => this.snippetService.readSnippet(snippetId)),
      );
      const ownershipMismatch = snippets.find(snippet => snippet.ownerPageId && snippet.ownerPageId !== page.id);
      if (ownershipMismatch) {
        this.toastService.showWarning(
          'Page conservée',
          'La propriété de certains articles doit être régularisée avant de supprimer cette page.',
        );
        return;
      }

      const parkedSnippets: Snippet[] = [];
      try {
        for (const snippet of snippets) {
          await this.clipboardService.addSnippet(snippet);
          parkedSnippets.push(snippet);
        }
        await this.pageService.deletePage(page);
      } catch (error) {
        for (const snippet of parkedSnippets.reverse()) {
          try {
            await this.snippetService.updateSnippet({ ...snippet, ownerPageId: snippet.ownerPageId ?? null });
            await this.clipboardService.removeSnippet(snippet.id);
          } catch {
            // The ownership audit reports any compensation that still needs manual repair.
          }
        }
        throw error;
      }

      this.pages = this.pages.filter(p => p.id !== page.id);
      if (this.selectedPageId === page.id) {
        this.selectedPage = null;
        this.selectedPageId = null;
        this.pageSnippets = [];
      }
      this.toastService.showSuccess('Page', 'Page supprimée et articles conservés');
    } catch (error) {
      this.toastService.showError('Erreur', 'Impossible de supprimer la page ou de conserver ses articles');
    }
  }

  // === FILE SELECTION MANAGEMENT ===

  setupFileSelectionListener(): void {
    // Listen to file selections from FileManager
    this.subscriptions.push(
      this.fileManager.fileSelected$.subscribe(selection => {
        if (selection && selection.context && this.activeSelectionSnippetId) {
          void this.handleFileSelection(selection as MediaSelection);
        }
      })
    );
  }

  onFileSelectionRequested(event: { type: 'image' | 'document' | 'folder', snippet: Snippet, context: string }): void {

    this.activeSelectionSnippetId = event.snippet.id;
    this.fileSelectionContext = event.context;
    this.mediaSelectionType = event.type;
    this.mediaImageProfile = event.type === 'image' && this.selectedPage
      ? imageProfileForTemplate(this.selectedPage.template)
      : null;
    this.fileMode = event.type === 'folder' ? 'upload' : 'browse';

    // Set the appropriate root folder based on selection type
    const rootFolder = event.type === 'image' ? 'images' :
      event.type === 'document' ? 'documents' :
        'albums';
    this.mediaRoot = rootFolder;

    if (event.type === 'image' && this.mediaImageProfile) {
      this.mediaTargetPath = cmsImageSourcePrefix(event.snippet.id, this.mediaImageProfile);
    } else {
      const mediaFolder = event.type === 'image' ? 'images' : event.type === 'document' ? 'documents' : 'album';
      this.mediaTargetPath = `${rootFolder}/cms/snippets/${event.snippet.id}/${mediaFolder}/`;
    }

    // Request file selection through FileManager
    this.fileManager.activateSelectionMode({
      type: event.type,
      context: event.context,
      targetId: event.snippet.id
    });

    // Navigate to the appropriate root folder
    this.fileManager.setCurrentRoot(rootFolder);
    const modalRef = this.modalService.open(this.mediaModal, {
      size: 'xl',
      centered: true,
      scrollable: true,
    });
    this.mediaModalRef = modalRef;
    modalRef.result.then(
      () => this.resetMediaSelection(modalRef),
      () => this.resetMediaSelection(modalRef),
    );
  }

  private async handleFileSelection(selection: MediaSelection): Promise<void> {
    if (selection.type !== 'image' || !this.mediaImageProfile) {
      await this.applyFileSelectionToSnippet(selection);
      return;
    }

    const currentRoot = this.fileManager.getCurrentRoot();
    const fullPath = selection.path.startsWith(currentRoot) ? selection.path : currentRoot + selection.path;
    this.clearMediaPreview();
    this.mediaPreviewLoading = true;

    try {
      this.pendingMediaBlob = await this.fileService.download_file(fullPath);
      this.pendingMediaSelection = selection;
      this.mediaPreviewUrl = URL.createObjectURL(this.pendingMediaBlob);
      this.mediaSourceSize = this.pendingMediaBlob.size;
      try {
        const dimensions = await this.readImageDimensions(this.mediaPreviewUrl);
        this.mediaSourceWidth = dimensions.width;
        this.mediaSourceHeight = dimensions.height;
      } catch {
        this.mediaSourceWidth = null;
        this.mediaSourceHeight = null;
      }
    } catch {
      this.toastService.showError('Illustration', 'Impossible de charger l’aperçu de l’image');
    } finally {
      this.mediaPreviewLoading = false;
    }
  }

  async confirmMediaSelection(): Promise<void> {
    if (!this.pendingMediaSelection || !this.pendingMediaBlob) return;
    await this.applyFileSelectionToSnippet(this.pendingMediaSelection, this.pendingMediaBlob);
  }

  cancelMediaPreview(): void {
    this.clearMediaPreview();
  }

  private async applyFileSelectionToSnippet(selection: MediaSelection, sourceBlob?: Blob, alreadyProcessed = false): Promise<void> {

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
    let fullPath = selection.path.startsWith(currentRoot) ? selection.path : currentRoot + selection.path;

    // Update the snippet object based on selection type
    if (selection.type === 'image') {
      if (this.mediaImageProfile && !alreadyProcessed) {
        try {
          this.mediaImporting = true;
          fullPath = await this.importCmsImageFromS3(fullPath, targetSnippet.id, this.mediaImageProfile, sourceBlob);
        } catch {
          this.toastService.showError('Illustration', 'Impossible d’optimiser l’image sélectionnée');
          return;
        } finally {
          this.mediaImporting = false;
        }
      }
      updatedSnippet.image = fullPath;
    } else if (selection.type === 'document') {
      updatedSnippet.file = fullPath;
    } else if (selection.type === 'folder') {
      updatedSnippet.folder = fullPath.replace(/\/+$/, '');
    }

    // Update the array with the new snippet instance to trigger change detection
    if (targetSnippetIndex !== -1) {
      this.pageSnippets[targetSnippetIndex] = updatedSnippet;
      this.pageSnippets = this.pageSnippets.slice(); // trigger change detection
    }

    // Persist the change to backend
    this.snippetService.updateSnippet(updatedSnippet).catch(() => {
      this.toastService.showError('Erreur', 'Impossible de sauvegarder la modification');
    });

    // Reset active selection
    this.clearMediaPreview();
    this.activeSelectionSnippetId = null;
    this.mediaModalRef?.close();
    this.mediaModalRef = null;
  }

  private async importCmsImageFromS3(sourcePath: string, snippetId: string, profile: CmsImageProfile, selectedBlob?: Blob): Promise<string> {
    const sourceBlob = selectedBlob ?? await this.fileService.download_file(sourcePath);
    const extensionMatch = sourcePath.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extensionMatch?.[1].toLowerCase() || 'jpg';
    const sourcePrefix = cmsImageSourcePrefix(snippetId, profile);
    const sourceFile = new File(
      [sourceBlob],
      `${globalThis.crypto.randomUUID()}.${extension}`,
      { type: sourceBlob.type || 'application/octet-stream' },
    );
    const cmsSourcePath = `${sourcePrefix}${sourceFile.name}`;
    const variantPath = cmsImageVariantPath(cmsSourcePath);

    await this.fileService.upload_file(sourceFile, sourcePrefix);
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        await firstValueFrom(this.fileService.getPresignedUrl$(variantPath, true, true));
        return variantPath;
      } catch {
        if (attempt === 29) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('CMS image processing timed out');
  }

  onMediaUploaded(paths: string[]): void {
    if (!this.activeSelectionSnippetId || !this.mediaSelectionType || paths.length === 0) return;

    void this.applyFileSelectionToSnippet({
      path: this.mediaSelectionType === 'folder' ? this.mediaTargetPath : paths[0],
      type: this.mediaSelectionType,
      context: this.fileSelectionContext,
      targetId: this.activeSelectionSnippetId,
    }, undefined, this.mediaSelectionType === 'image' && !!this.mediaImageProfile);
  }

  closeMediaModal(): void {
    const modalRef = this.mediaModalRef;
    this.resetMediaSelection(modalRef);
    modalRef?.dismiss();
  }

  private resetMediaSelection(modalRef: NgbModalRef | null): void {
    if (this.mediaModalRef && modalRef && this.mediaModalRef !== modalRef) return;
    this.fileManager.cancelSelectionMode();
    this.activeSelectionSnippetId = null;
    this.mediaSelectionType = null;
    this.mediaImageProfile = null;
    this.mediaImporting = false;
    this.mediaPreviewLoading = false;
    this.clearMediaPreview();
    this.mediaModalRef = null;
  }

  private clearMediaPreview(): void {
    if (this.mediaPreviewUrl) URL.revokeObjectURL(this.mediaPreviewUrl);
    this.mediaPreviewUrl = null;
    this.pendingMediaSelection = null;
    this.pendingMediaBlob = null;
    this.mediaSourceWidth = null;
    this.mediaSourceHeight = null;
    this.mediaSourceSize = null;
  }

  private readImageDimensions(sourceUrl: string): Promise<{ width: number, height: number }> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('Image dimensions unavailable'));
      image.src = sourceUrl;
    });
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
      title: '',
      subtitle: '',
      content: '',
      image: '',
      publishedAt: publishedAt,
      public: true,
      featured: false,
      file: '',
      folder: '',
      ownerPageId: this.selectedPage.id,
    };

    try {
      const created = await this.snippetService.createSnippet(newSnippet);
      if (created) {
        const originalSnippetIds = [...this.selectedPage.snippet_ids];
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
          this.selectedPage.snippet_ids = originalSnippetIds;
          this.pageSnippets = this.pageSnippets.filter(item => item.id !== created.id);
          if (pageIndex !== -1) {
            this.pages[pageIndex] = { ...this.selectedPage };
            this.pages = [...this.pages];
          }
          this.openSnippetId = null;
          try {
            await this.snippetService.deleteSnippet(created);
          } catch {
            this.toastService.showError('Erreur', 'Article créé sans rattachement : une régularisation est nécessaire');
            return;
          }
          this.toastService.showError('Erreur', 'Impossible de rattacher le nouvel article à la page');
        }
      }
    } catch (error) {
      this.toastService.showError('Erreur', 'Impossible de créer l\'article');
    }
  }

  onSnippetAccordionClick(snippet: Snippet): void {
    this.openSnippetId = snippet.id;
  }

  get selectedSnippet(): Snippet | null {
    return this.pageSnippets.find(snippet => snippet.id === this.openSnippetId) ?? null;
  }

  get filteredPages(): Page[] {
    return this.pages.filter(page => !this.is_Clipboard(page));
  }

  get mediaImageProfileDefinition() {
    return this.mediaImageProfile ? CMS_IMAGE_PROFILES[this.mediaImageProfile] : null;
  }

  get mediaImageTargetDescription(): string {
    return this.mediaImageProfile ? cmsImageTargetDescription(this.mediaImageProfile) : '';
  }

  isPageLinked(page: Page): boolean {
    return this.linkedPageIds.has(page.id);
  }

  isSnippetComplete(snippet: Snippet): boolean {
    return !this.selectedPage || snippetMissingFields(snippet, this.selectedPage.template).length === 0;
  }

  onSnippetSaved(snippet: Snippet): void {
    const index = this.pageSnippets.findIndex(s => s.id === snippet.id);
    if (index !== -1) {
      this.pageSnippets[index] = snippet;
      this.pageSnippets = [...this.pageSnippets];
    }
  }

  async deleteSnippetFromCurrentPage(snippet: Snippet): Promise<void> {
    const confirmed = confirm(`Supprimer le snippet « ${snippet.title} » ?`);
    if (!confirmed || !this.selectedPage) return;

    const sourcePage = this.selectedPage;
    try {
      const persistedSnippet = await this.snippetService.readSnippet(snippet.id);
      if (persistedSnippet.ownerPageId !== sourcePage.id) {
        this.toastService.showWarning('Article conservé', 'La propriété de cet article doit être régularisée avant sa suppression.');
        return;
      }

      const updatedPage = {
        ...sourcePage,
        snippet_ids: sourcePage.snippet_ids.filter(id => id !== snippet.id),
      };
      await this.pageService.updatePage(updatedPage);
      try {
        await this.snippetService.deleteSnippet(persistedSnippet);
      } catch (error) {
        await this.pageService.updatePage(sourcePage);
        throw error;
      }

      this.selectedPage = updatedPage;
      this.pageSnippets = this.pageSnippets.filter(item => item.id !== snippet.id);
      this.toastService.showSuccess('Article', 'Article supprimé');
    } catch {
      this.toastService.showError('Erreur', 'Impossible de supprimer l\'article');
    }
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
        this.toastService.showError('Erreur', 'Impossible de sauvegarder l\'ordre des articles');
      }
    }
  }

  // === CLIPBOARD METHODS ===

  async moveSnippetToClipboard(snippet: Snippet): Promise<void> {
    const index = this.pageSnippets.findIndex(s => s.id === snippet.id);
    if (index > -1 && this.selectedPage) {
      const sourcePage = this.selectedPage;
      const updatedSourcePage = {
        ...sourcePage,
        snippet_ids: sourcePage.snippet_ids.filter(id => id !== snippet.id),
      };

      try {
        await this.clipboardService.addSnippet(snippet);
        try {
          await this.pageService.updatePage(updatedSourcePage);
        } catch (error) {
          await this.snippetService.updateSnippet({ ...snippet, ownerPageId: sourcePage.id });
          await this.clipboardService.removeSnippet(snippet.id);
          throw error;
        }

        this.selectedPage = updatedSourcePage;
        this.pageSnippets = this.pageSnippets.filter(item => item.id !== snippet.id);
        this.toastService.showSuccess('Article', 'Article déplacé vers le presse-papiers');
      } catch {
        this.toastService.showError('Erreur', 'Impossible de déplacer l\'article');
      }
    }
  }

  async restoreSnippetFromClipboard(snippet: Snippet, modal?: NgbModalRef): Promise<void> {
    if (!this.selectedPage) return;

    const destinationPage = this.selectedPage;
    const restoredSnippet = { ...snippet, ownerPageId: destinationPage.id };
    const updatedDestinationPage = {
      ...destinationPage,
      snippet_ids: destinationPage.snippet_ids.includes(snippet.id)
        ? [...destinationPage.snippet_ids]
        : [...destinationPage.snippet_ids, snippet.id],
    };

    try {
      await this.pageService.updatePage(updatedDestinationPage);
      try {
        await this.snippetService.updateSnippet(restoredSnippet);
      } catch (error) {
        await this.pageService.updatePage(destinationPage);
        throw error;
      }
      try {
        await this.clipboardService.removeSnippet(snippet.id);
      } catch (error) {
        await this.snippetService.updateSnippet(snippet);
        await this.pageService.updatePage(destinationPage);
        throw error;
      }

      this.selectedPage = updatedDestinationPage;
      if (!this.pageSnippets.some(item => item.id === snippet.id)) {
        this.pageSnippets = [...this.pageSnippets, restoredSnippet];
      }

      modal?.close();
      this.toastService.showSuccess('Article', 'Article restitué depuis le presse-papiers');
    } catch {
      this.toastService.showError('Erreur', 'Impossible de restituer l\'article');
    }
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
    if (mode === 'browse' && this.mediaSelectionType && this.activeSelectionSnippetId) {
      this.fileManager.activateSelectionMode({
        type: this.mediaSelectionType,
        context: this.fileSelectionContext,
        targetId: this.activeSelectionSnippetId,
      });
      this.fileManager.setCurrentRoot(this.mediaRoot);
    }
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
