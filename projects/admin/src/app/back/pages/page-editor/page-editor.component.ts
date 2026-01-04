
import { Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild, ChangeDetectorRef } from '@angular/core';
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
import { FileSystemSelectorComponent } from '../file-system-selector/file-system-selector.component';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-page-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    CdkDrag,
    CdkDropList,
    FileSystemSelectorComponent,
    GenericPageComponent,
    SnippetEditor
  ],
  templateUrl: './page-editor-progressive.component.html',
  styleUrl: './page-editor.component.scss'
})
export class PageEditorComponent implements OnChanges, OnInit {
  openSnippetId: string | null = null;
  private loadingPage: boolean = false;
  
  // Gestion S3 Colonne 3
  s3Mode: 'snippet-editor' | 'file-manager' = 'file-manager';
  s3TargetRoot: string = S3_ROOT_FOLDERS.IMAGES;
  s3CurrentPath: string = '';
  S3_ROOT_FOLDERS = S3_ROOT_FOLDERS;
  
  // Propriétés pour communication inter-colonnes
  fileSelectionMode: boolean = false;
  fileSelectionContext: string = '';
  fileSelectionType: 'image' | 'document' | 'folder' = 'image';
  fileSelectionTargetSnippet: Snippet | null = null;
  selectedFilePathForSnippet: string | null = null;
  
  // Propriétés uploader
  filesByRoot: { [key: string]: File[] } = {};
  uploading: boolean = false;
  
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
    private clipboardService: ClipboardService,
    private fileService: FileService,
    private cdr: ChangeDetectorRef) {
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

  ngOnInit(): void {
    console.log('ngOnInit - pageId:', this.pageId);
    // Version sécurisée : charger vraie page si disponible
    if (this.pageId && !this.selected_page) {
      this.loadRealPage();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pageId'] && this.pageId && changes['pageId'].currentValue !== changes['pageId'].previousValue) {
      this.selected_snippet = null;
      this.openSnippetId = null;
      this.loadRealPage();
    }
  }

  loadRealPage(): void {
    try {
      const page = this.pageService.getPage(this.pageId);
      if (page) {
        this.selected_page = page;
        this.pageForm.patchValue({
          title: page.title,
          template: page.template
        });
        
        // Charger les vrais snippets
        this.loadRealSnippets();
        
        console.log('Real page loaded:', page.title, 'loading snippets...');
        
        const titleControl = this.pageForm.get('title');
        if (page.title === CLIPBOARD_TITLE) {
          titleControl?.disable({ emitEvent: false });
          this.is_clipboard_page = true;
        } else {
          titleControl?.enable({ emitEvent: false });
          this.is_clipboard_page = false;
        }
        
        this.cdr.detectChanges();
      } else {
        console.error('Page not found, fallback to test page');
        this.createTestPage();
      }
    } catch (error) {
      console.error('Error loading real page:', error);
      this.createTestPage();
    }
  }

  createTestPage(): void {
    console.log('Creating test page for ID:', this.pageId);
    this.selected_page = {
      id: this.pageId,
      title: `Page ${this.pageId}`,
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: ['test1', 'test2', 'test3']
    } as Page;
    
    this.pageForm.patchValue({
      title: this.selected_page.title,
      template: this.selected_page.template
    });
    
    // Créer quelques snippets factices pour test
    this.pageSnippets = [
      { id: 'test1', title: 'Article principal', subtitle: 'Contenu principal de la page', content: '', public: true, image: '', file: '', folder: '', featured: false },
      { id: 'test2', title: 'Actualités', subtitle: 'Dernières nouvelles', content: '', public: true, image: '', file: '', folder: '', featured: false },
      { id: 'test3', title: 'Contact', subtitle: 'Informations de contact', content: '', public: true, image: '', file: '', folder: '', featured: false }
    ];
    
    this.is_clipboard_page = false;
    this.cdr.detectChanges();
  }


  loadPage(): void {
    if (this.loadingPage) {
      console.log('loadPage already in progress, skipping');
      return;
    }
    this.loadingPage = true;
    console.log('Loading page with ID:', this.pageId);
    
    try {
      // SIMPLIFIÉ : Créer une page factice pour tester
      this.selected_page = {
        id: this.pageId,
        title: `Page Test ${this.pageId}`,
        template: PAGE_TEMPLATES.PUBLICATION,
        snippet_ids: []
      } as Page;
      
      this.pageForm.patchValue({
        title: this.selected_page.title,
        template: this.selected_page.template
      });
      
      // Snippets vides pour le test
      this.pageSnippets = [];
      console.log('Test page created successfully');
      
      const titleControl = this.pageForm.get('title');
      titleControl?.enable({ emitEvent: false });
      this.is_clipboard_page = false;
      
      this.cdr.detectChanges();
      this.loadingPage = false;
    } catch (error) {
      console.error('Error in loadPage:', error);
      this.loadingPage = false;
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
    return this.selected_page?.title || 'Aucune page';
  }

  page_row_cols(page: Page | null | undefined): { SM: number; MD: number; LG: number; XL: number } {
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

  onSnippetAccordionClick(snippet: Snippet): void {
    // Gestion de l'accordéon
    this.openSnippetId = (this.openSnippetId === snippet.id ? null : snippet.id);
    
    // Sélection du snippet et passage en mode snippet-editor si accordéon ouvert
    if (this.openSnippetId === snippet.id) {
      this.selected_snippet = snippet;
      this.switchToSnippetEditorMode();
    } else {
      this.selected_snippet = null;
    }
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
      this.pageSnippets.unshift(created);
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
  loadRealSnippets(): void {
    try {
      this.snippetService.listSnippets().subscribe({
        next: (snippets) => {
          this.snippets = snippets || [];
          if (this.selected_page) {
            this.pageSnippets = this.selected_page.snippet_ids
              .map(id => snippets?.find(s => s.id === id))
              .filter(s => s !== undefined) as Snippet[];
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('Error loading real snippets:', error);
          // Fallback vers snippets factices en cas d'erreur
          this.createFallbackSnippets();
        },
        complete: () => {
          console.log('Real snippets loading completed');
        }
      });
    } catch (error) {
      console.error('Error in loadRealSnippets:', error);
      this.createFallbackSnippets();
    }
  }

  createFallbackSnippets(): void {
    console.log('Creating fallback snippets for page');
    if (this.selected_page) {
      this.pageSnippets = this.selected_page.snippet_ids.map((id, index) => ({
        id: id,
        title: `Article ${index + 1}`,
        subtitle: `Snippet ID: ${id}`,
        content: '',
        public: true,
        image: '',
        file: '',
        folder: '',
        featured: false
      }));
    }
    this.cdr.detectChanges();
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

  onSnippetSaved(updatedSnippet: Snippet) {
    if (!updatedSnippet) return;
    // update pageSnippets array entry if present — replace with new object and refresh array reference
    const idx = this.pageSnippets.findIndex(s => s.id === updatedSnippet.id);
    if (idx > -1) {
      this.pageSnippets[idx] = { ...updatedSnippet } as Snippet;
      this.pageSnippets = this.pageSnippets.slice(); // refresh reference for change detection
    }
    // also update global snippets list and selected_snippet
    const globalIdx = this.snippets.findIndex(s => s.id === updatedSnippet.id);
    if (globalIdx > -1) {
      this.snippets[globalIdx] = { ...updatedSnippet } as Snippet;
      this.snippets = this.snippets.slice();
    }
    if (this.selected_snippet && this.selected_snippet.id === updatedSnippet.id) {
      this.selected_snippet = { ...updatedSnippet } as Snippet;
    }
  }

  // === MÉTHODES S3 GESTION COLONNE 3 ===
  
  switchToSnippetEditorMode(): void {
    this.s3Mode = 'snippet-editor';
  }
  
  switchToFileManagerMode(): void {
    this.s3Mode = 'file-manager';
  }
  
  onS3FileSelected(path: string): void {
    this.s3CurrentPath = path;
    
    if (this.fileSelectionMode) {
      // Mode sélection : juste stocker le path, l'utilisateur cliquera sur "Appliquer"
      this.toastService.showInfo('Sélection', `Fichier sélectionné: ${path}`);
    } else {
      // Mode navigation normal
      this.toastService.showInfo('Fichier', `Fichier sélectionné: ${path}`);
    }
  }
  
  getS3RootOptions(): Array<{value: string, label: string}> {
    return [
      { value: S3_ROOT_FOLDERS.IMAGES, label: 'Images' },
      { value: S3_ROOT_FOLDERS.ALBUMS, label: 'Albums' },
      { value: S3_ROOT_FOLDERS.DOCUMENTS, label: 'Documents' }
    ];
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

  // Méthodes uploader
  getDataUsageForRoot(root: string): string[] {
    switch (root) {
      case 'images':
        return ['Stockage des images de snippets', 'Formats: JPG, PNG, WebP', 'Taille max recommandée: 2MB'];
      case 'albums':
        return ['Albums photo et galeries', 'Organisation par événements', 'Génération automatique de vignettes'];
      case 'documents':
        return ['Documents PDF, Word, Excel', 'Fichiers téléchargeables', 'Taille max: 10MB'];
      default:
        return ['Volume de stockage S3'];
    }
  }
  
  triggerFileDialog(root: string): void {
    const fileInput = document.getElementById(`file-input-${root}`) as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }
  
  acceptFilter(root: string): string {
    switch (root) {
      case 'images':
        return 'image/*';
      case 'documents':
        return '.pdf,.doc,.docx,.xls,.xlsx,.txt';
      default:
        return '*';
    }
  }
  
  onFilesSelected(event: any, root: string): void {
    const files = Array.from(event.target.files) as File[];
    if (!this.filesByRoot[root]) {
      this.filesByRoot[root] = [];
    }
    this.filesByRoot[root] = files;
    this.toastService.showSuccess('Fichiers', `${files.length} fichier(s) sélectionné(s)`);
  }
  
  uploadAllFor(root: string): void {
    this.uploading = true;
    this.toastService.showInfo('Upload', 'Upload en cours...');
    // Simulation upload
    setTimeout(() => {
      this.uploading = false;
      this.filesByRoot[root] = [];
      this.toastService.showSuccess('Upload', 'Upload terminé avec succès');
    }, 2000);
  }
  
  // Méthodes communication inter-colonnes
  activateFileSelection(type: 'image' | 'document' | 'folder', snippet: Snippet, context: string): void {
    this.fileSelectionMode = true;
    this.fileSelectionType = type;
    this.fileSelectionTargetSnippet = snippet;
    this.fileSelectionContext = context;
    
    // Basculer sur le bon volume
    if (type === 'image') {
      this.s3TargetRoot = S3_ROOT_FOLDERS.IMAGES;
    } else if (type === 'document') {
      this.s3TargetRoot = S3_ROOT_FOLDERS.DOCUMENTS;
    }
    
    this.toastService.showInfo('Sélection', `Mode sélection activé pour ${context}`);
  }
  
  cancelFileSelection(): void {
    this.fileSelectionMode = false;
    this.fileSelectionContext = '';
    this.fileSelectionTargetSnippet = null;
    this.s3CurrentPath = '';
  }
  
  applyFileSelection(): void {
    if (!this.fileSelectionTargetSnippet || !this.s3CurrentPath) return;
    
    // Set properties for snippet-editor to receive
    this.selectedFilePathForSnippet = this.s3CurrentPath;
    
    this.toastService.showSuccess('Sélection', `${this.s3CurrentPath} sélectionné`);
    
    // Reset after a small delay to allow snippet-editor to process
    setTimeout(() => {
      this.selectedFilePathForSnippet = null;
      this.cancelFileSelection();
    }, 100);
  }

  // Méthode appelée par le snippet-editor pour déclencher une sélection
  onSnippetRequestFileSelection(request: {type: 'image' | 'document' | 'folder', snippet: Snippet, context: string}): void {
    this.activateFileSelection(request.type, request.snippet, request.context);
  }
}
