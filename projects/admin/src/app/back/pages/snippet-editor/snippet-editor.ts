import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { Snippet } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SnippetService } from '../../../common/services/snippet.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SnippetModalEditorComponent } from '../../site/snippet-modal-editor/snippet-modal-editor.component';
import { map, Observable } from 'rxjs';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-snippet-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './snippet-editor.html',
  styleUrl: './snippet-editor.scss'
})
export class SnippetEditor implements OnChanges {
  @Input() snippet: Snippet | null = null;
  @Output() saved = new EventEmitter<Snippet>();

  form: FormGroup;
  saving = false;

  file_paths$ !: Observable<string[]>;
  thumbnails$ !: Observable<string[]>;
  albums$ !: Observable<string[]>;

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
    this.albums$ = this.fileService.list_folders(S3_ROOT_FOLDERS.ALBUMS + '/');
    this.thumbnails$ = this.fileService.list_files(S3_ROOT_FOLDERS.IMAGES + '/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );
    this.file_paths$ = this.fileService.list_files(S3_ROOT_FOLDERS.DOCUMENTS + '/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );
    // Met à jour l'image_url immédiatement quand l'input change
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
    // Continue to save on blur/Enter
    const imageInput = document.querySelector('input[formControlName="image"]');
    if (imageInput) {
      imageInput.addEventListener('blur', () => {
        if (this.snippet) {
          this.snippet.image = this.form.get('image')?.value;
          this.saveSnippetSelected();
        }
      });
      imageInput.addEventListener('keydown', (event: Event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === 'Enter' && this.snippet) {
          this.snippet.image = this.form.get('image')?.value;
          this.saveSnippetSelected();
        }
      });
    }
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
