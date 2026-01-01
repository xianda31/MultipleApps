
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
  imports: [CommonModule, ReactiveFormsModule, FormsModule, FileSystemSelectorComponent],
  templateUrl: './snippet-editor.html',
  styleUrls: ['./snippet-editor.scss']
})
export class SnippetEditor implements OnChanges {
  @Input() snippet: Snippet | null = null;
  @Output() saved = new EventEmitter<Snippet>();
  
  public readonly S3_ROOT_FOLDERS = S3_ROOT_FOLDERS;
  form: FormGroup;
  saving = false;
  showImageSelector = false;
  showFileSelector = false;
  showFolderSelector = false;

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
    // Force refresh/emit for parent or view update
    setTimeout(() => {
      if (typeof this.saved !== 'undefined' && this.saved.emit) {
        this.saved.emit({ ...this.snippet, ...this.form.value });
      }
    }, 0);
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
    // Patch publishedAt to yyyy-MM-dd if present
    let formValue = { ...this.form.value };
    if (formValue.publishedAt) {
      // Only keep yyyy-MM-dd part if value is ISO string
      if (typeof formValue.publishedAt === 'string' && formValue.publishedAt.length > 10) {
        formValue.publishedAt = formValue.publishedAt.substring(0, 10);
      }
    }
    const payload: any = { ...this.snippet, ...formValue };
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
    // Mémorise l'élément ayant le focus avant ouverture du modal
    const lastFocused: HTMLElement | null = document.activeElement as HTMLElement;
    const modalRef = this.modalService.open(SnippetModalEditorComponent, { centered: true });
    // Pass a copy to avoid mutating the original before save
    modalRef.componentInstance.snippet = { ...snippet };
    modalRef.result.then((result) => {
      if (!result) return;
      // Replace the snippet reference and patch form
      this.snippet = { ...this.snippet, ...result };
      this.form.patchValue({ content: result.content || '' });
      this.saveSnippetSelected();
    }).finally(() => {
      // Restaure le focus sur l'élément précédent
      if (lastFocused) setTimeout(() => lastFocused.focus(), 0);
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


    public getNameFromPath(path?: string | null): string {
      if (!path) return '';
      const idx = path.lastIndexOf('/');
      if (idx === -1) return path;
      // If path ends with '/', remove it and try again
      if (idx === path.length - 1) return this.getNameFromPath(path.slice(0, -1));
      return path.slice(idx + 1);
    }

}
