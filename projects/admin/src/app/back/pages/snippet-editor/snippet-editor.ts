import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { Snippet } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SnippetService } from '../../../common/services/snippet.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SnippetModalEditorComponent } from '../../site/snippet-modal-editor/snippet-modal-editor.component';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { DomSanitizer } from '@angular/platform-browser';
import { FileSystemSelectorComponent } from '../file-system-selector/file-system-selector.component';

@Component({
  selector: 'app-snippet-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './snippet-editor.html',
  styleUrls: ['./snippet-editor.scss']
})
export class SnippetEditor implements OnChanges {
  @Input() snippet: Snippet | null = null;
  @Output() saved = new EventEmitter<Snippet>();

  form: FormGroup;
  saving = false;

  // selectors are opened as modals when needed
  

  constructor(
    private snippetService: SnippetService,
    private modalService: NgbModal,
    private fileService: FileService,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      id: [''],
      title: ['', Validators.required],
      subtitle: [''],
      content: [''],
      publishedAt: [''],
      public: [true],
      featured: [false],
      image: [''],
      file: [''],
      folder: ['']
    });
  }

  ngOnInit(): void {
    this.form.get('image')?.valueChanges.subscribe((val) => {
      if (this.snippet) {
        this.snippet.image = val;
        // Met à jour l'URL S3 si le chemin est non vide
        if (val) {
          this.fileService.getPresignedUrl$(val, true).subscribe({
            next: (url) => {
              (this.snippet as any).image_url = url;
            },
            error: () => {
              (this.snippet as any).image_url = val; // fallback to raw value
            }
          });
        } else {
          (this.snippet as any).image_url = '';
        }
      }
    });
  }

  // Open selectors as NgbModal components and handle their events
  openImageSelectorModal() {
    const modalRef = this.modalService.open(FileSystemSelectorComponent as any, { size: 'lg', centered: true });
    const cmp = modalRef.componentInstance as any;
    cmp.rootFolder = S3_ROOT_FOLDERS.IMAGES + '/';
    cmp.mode = 'files';
    if (cmp.select && cmp.select.subscribe) cmp.select.subscribe((path: string) => { this.selectImage(path); modalRef.close(); });
    if (cmp.close && cmp.close.subscribe) cmp.close.subscribe(() => modalRef.close());
  }

  openFileSelectorModal() {
    const modalRef = this.modalService.open(FileSystemSelectorComponent as any, { size: 'lg', centered: true });
    const cmp = modalRef.componentInstance as any;
    cmp.rootFolder = S3_ROOT_FOLDERS.DOCUMENTS + '/';
    cmp.mode = 'files';
    if (cmp.select && cmp.select.subscribe) cmp.select.subscribe((path: string) => { this.selectFile(path); modalRef.close(); });
    if (cmp.close && cmp.close.subscribe) cmp.close.subscribe(() => modalRef.close());
  }

  openFolderSelectorModal() {
    const modalRef = this.modalService.open(FileSystemSelectorComponent as any, { size: 'lg', centered: true });
    const cmp = modalRef.componentInstance as any;
    cmp.rootFolder = S3_ROOT_FOLDERS.ALBUMS + '/';
    cmp.mode = 'folders';
    if (cmp.select && cmp.select.subscribe) cmp.select.subscribe((path: string) => { this.selectFolder(path); modalRef.close(); });
    if (cmp.close && cmp.close.subscribe) cmp.close.subscribe(() => modalRef.close());
  }

  selectImage(path: string) {
    this.form.get('image')?.setValue(path);
    if (this.snippet) {
      this.snippet.image = path;
    }
    this.saveSnippetSelected();
  }

  selectFile(path: string) {
    this.form.get('file')?.setValue(path);
    if (this.snippet) { this.snippet.file = path; }
    this.saveSnippetSelected();
  }

  selectFolder(path: string) {
    // store folder path (no filename) into form and snippet
    this.form.get('folder')?.setValue(path);
    if (this.snippet) { this.snippet.folder = path; }
    this.saveSnippetSelected();
  }

  onEnterSave(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    // ensure the form control value has been applied, run in next tick
    setTimeout(() => this.saveSnippetSelected(), 0);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['snippet'] && this.snippet) {
      // Patch form values from input snippet without replacing controls
      this.form.patchValue({
        id: this.snippet.id || '',
        title: this.snippet.title || '',
        subtitle: this.snippet.subtitle || '',
        content: this.snippet.content || '',
        publishedAt: this.snippet.publishedAt || this.toDateInputValue(this.snippet.updatedAt) || '',
        public: !!this.snippet.public,
        featured: !!this.snippet.featured,
        image: this.snippet.image || '',
        file: this.snippet.file || '',
        folder: this.snippet.folder || ''
      }, { emitEvent: false });
    }
  }

  async saveSnippetSelected() {
    if (!this.snippet) return;
    if (this.saving) return;
    const payload: any = { ...this.snippet, ...this.form.value };
    this.saving = true;
    try {
      const updatedSnippet = await this.snippetService.updateSnippet(payload);
      // Emit updated snippet so parent can merge it into its state and keep references stable
      this.saved.emit(updatedSnippet as Snippet);
      // Refresh form with canonical values from backend
      this.form.patchValue({
        title: updatedSnippet.title || '',
        subtitle: updatedSnippet.subtitle || '',
        content: updatedSnippet.content || '',
        publishedAt: updatedSnippet.publishedAt || '',
        public: !!updatedSnippet.public,
        featured: !!updatedSnippet.featured,
        image: updatedSnippet.image || '',
        file: updatedSnippet.file || '',
        folder: updatedSnippet.folder || ''
      }, { emitEvent: false });
    } catch (error) {
      console.error('Error updating snippet:', error);
    } finally {
      this.saving = false;
    }
  }

  // For toggle/change events driven from template: update the form control and save
  onToggleChange(field: string, value?: any) {
    if (!this.snippet) return;
    if (value === undefined) {
      // read from control if event didn't pass the value
      value = this.form.get(field)?.value;
    } else {
      this.form.get(field)?.setValue(value, { emitEvent: false });
    }
    this.saveSnippetSelected();
  }

  onSnippetContentClick(snippet: Snippet) {
    const modalRef = this.modalService.open(SnippetModalEditorComponent, { centered: true });
    modalRef.componentInstance.snippet = snippet;
    modalRef.result.then((result) => {
      if (!result) return;
      // Patch modal result into the form and save
      this.form.patchValue({ content: result.content || '' });
      this.saveSnippetSelected();
    });
  }

  stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }

  private toDateInputValue(value: any): string | undefined {
    if (!value) return undefined;
    const d = (value instanceof Date) ? value : new Date(value);
    if (isNaN(d.getTime())) return undefined;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }


}
