import { Component } from '@angular/core';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { Form, FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '../../../common/services/toast.service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { combineLatest, map, Observable, switchMap, take } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SnippetModalEditorComponent } from '../../site/snippet-modal-editor/snippet-modal-editor.component';
import { FileService } from '../../../common/services/files.service';



@Component({
  selector: 'app-pages-editor',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule],
  templateUrl: './pages-editor.component.html',
  styleUrl: './pages-editor.component.scss'
})
export class PagesEditorComponent {
  pages: Page[] = [];
  snippets: Snippet[] = [];
  selected_snippet: Snippet | null = null;
  selected_snippet_image: string = '';
  selected_snippet_file: string = '';
  pagesForm !: FormGroup;
  pageTemplates = Object.values(PAGE_TEMPLATES);

  file_paths$ !: Observable<string[]>;
  thumbnails$ !: Observable<string[]>;

  constructor(
    private pageService: PageService,
    private snippetService: SnippetService,
    private fb: FormBuilder,
    private toastService: ToastService,
    private modalService: NgbModal,
    private fileService: FileService
  ) {
    this.pagesForm = this.fb.group({
      pagesArray: this.fb.array([])   // pour eviter les erreurs DOM à l'initialisation
    });
  }

  ngOnInit(): void {

    this.file_paths$ = this.fileService.list_files('documents/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );
    this.thumbnails$ = this.fileService.list_files('images/vignettes/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );


    this.pageService.listPages().pipe(take(1)).subscribe(pages => {

      // check if all mandatory pages exist

      const requiredTitles = Object.values(MENU_TITLES);
      requiredTitles.forEach(title => {
        const pageExists = pages.some(page => page.title === title);
        if (!pageExists) {
          this.pageService.createPage({
            id: '',
            title: title,
            template: PAGE_TEMPLATES.X_DEFAULT,
            snippet_ids: []
          });
          this.toastService.showInfo('Pages', `La page "${title}" manquait, et à été créée`);
        }
      });
      // subscribe "normally"

      combineLatest([this.pageService.listPages(), this.snippetService.listSnippets()])
        .subscribe(([pages, snippets]) => {
          this.pages = pages;
          this.snippets = snippets;
          this.pages.forEach(page => {
            page.snippets = this.getPageSnippets(page);
            page.snippet_ids = page.snippets.map(snippet => snippet.id);
          });
          this.initFormArray(this.pages);
        });
    });
  }



  //getters
  get pagesFormArray(): FormArray {
    return this.pagesForm.get('pagesArray') as FormArray;
  }
  get pageGroups(): FormGroup[] {
    return this.pagesFormArray.controls as FormGroup[];
  }

  initFormArray(pages: Page[]): void {

    this.pagesForm = this.fb.group({
      pagesArray: this.fb.array(pages.map(page => this.fb.group({
        touched: [false],
        id: [page.id],
        title: [page.title],
        template: [page.template],
        snippet_ids: [page.snippet_ids || []],
        snippets: [page.snippets || []]
      })))
    });
  }


  getPageSnippets(page: Page): Snippet[] {
    return this.snippets.filter(snippet => snippet.template === page.title);
  }

  savePage(pageGroup: FormGroup): void {

    const isNew = pageGroup.get('id')?.value === '';
    let page: Page = {
      id: pageGroup.get('id')?.value,
      title: pageGroup.get('title')?.value,
      template: pageGroup.get('template')?.value,
      snippet_ids: pageGroup.get('snippet_ids')?.value
    };

    if (isNew) {
      this.pageService.createPage(page).then(() => {
        this.toastService.showSuccess('Pages', 'Page créée avec succès');
      });
    } else {
      this.pageService.updatePage(page).then(() => {
        this.toastService.showSuccess('Pages', 'Page mise à jour avec succès');
      });
    }
  }

  onSnippetClick(snippet: Snippet) {
    // this.openSnippetEditorCanvas();
  }


  onHover(snippet?: Snippet) {
    // this.selected_snippet_image = snippet?.image || '';
    // this.selected_snippet_file = snippet?.file || '';
    this.selected_snippet = snippet || null;
  }

  onSnippetContentClick(snippet: Snippet) {
    const modalRef = this.modalService.open(SnippetModalEditorComponent, { centered: true });
    modalRef.componentInstance.snippet = snippet;
    modalRef.result.then((result) => {
      console.log('Snippet content modified:', result);
      if (result) {
        this.selected_snippet = result;
        this.snippetService.updateSnippet(result)
          .then(() => { })
          .catch(error => {
            console.error('Error updating snippet:', error);
          });
      }
    });
  }

  onImageChange() {
    console.log('Image changed:', this.selected_snippet_image);
    if (this.selected_snippet) {
      this.selected_snippet.image = this.selected_snippet_image;
      this.snippetService.updateSnippet(this.selected_snippet)
        .then((snippet) => {
          this.selected_snippet_image = '';
          this.selected_snippet = snippet; // force refresh
        })
        .catch(error => {
          console.error('Error updating snippet:', error);
        });
    }
  }

  onFileChange() {
    console.log('File changed:', this.selected_snippet_file);
    if (this.selected_snippet) {
      this.selected_snippet.file = this.selected_snippet_file;
      this.snippetService.updateSnippet(this.selected_snippet)
        .then((snippet) => {
          this.selected_snippet_file = '';
          this.selected_snippet = snippet; // force refresh
        })
        .catch(error => {
          console.error('Error updating snippet:', error);
        });
      }
    }

    onPublicToggle() {
      if (this.selected_snippet) {
        this.selected_snippet.public = !this.selected_snippet.public;
        this.snippetService.updateSnippet(this.selected_snippet)
          .then((snippet) => {
            this.selected_snippet = snippet; // force refresh
          })
          .catch(error => {
            console.error('Error updating snippet:', error);
          });
      }
    }
  }