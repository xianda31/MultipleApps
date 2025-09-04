import { Component, computed, signal } from '@angular/core';
import { ViewChild, ElementRef } from '@angular/core';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../common/services/toast.service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { combineLatest, map, Observable, take, tap } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SnippetModalEditorComponent } from '../../site/snippet-modal-editor/snippet-modal-editor.component';
import { FileService } from '../../../common/services/files.service';
import { CdkDrag, CdkDropList, CdkDragDrop, moveItemInArray, transferArrayItem, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { FileSystemNode, getChildNodes, isFolder, S3Item } from '../../../common/interfaces/file.interface';
import { InputFileComponent } from "../../files/input-file/input-file.component";


@Component({
  selector: 'app-pages-editor',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule, CdkDrag, CdkDropList, CdkDropListGroup, InputFileComponent],
  templateUrl: './pages-editor.component.html',
  styleUrl: './pages-editor.component.scss'
})
export class PagesEditorComponent {
  @ViewChild('scrollable') scrollable!: ElementRef;

  resolution_too_small = false;

  pages: Page[] = [];
  bin_page_index: number | null = null;

  snippets: Snippet[] = [];
  selected_snippet: Snippet | null = null;

  view_snippet = signal<boolean>(true);
  freeze_view_snippet = signal<boolean>(false);
  show_trash = false;

  pagesForm !: FormGroup;
  pageTemplates = Object.values(PAGE_TEMPLATES);


  file_paths$ !: Observable<string[]>;
  fileSystemNode !: FileSystemNode;
  thumbnails$ !: Observable<string[]>;
  
  
  current_node_childs = signal<FileSystemNode | null>(null);
  node_stack: FileSystemNode[] = [];
  returned_value : any;

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

    if (window.innerWidth < 768) {
      this.resolution_too_small = true;
    }

    this.fileService.list_files_full('documents/').pipe(
      map((S3items) => this.fileService.processStorageList(S3items)),
    ).subscribe((fileSystemNode) => {
      this.fileSystemNode = (fileSystemNode);
      // this.open_node(fileSystemNode);
      //  this.node_stack.push(fileSystemNode);

      console.log('File system loaded:', this.fileSystemNode);
    });


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
            snippet_ids: [],

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
          });
          // force bin_page to be the first page
          const binPage = this.pages.find(page => page.title === MENU_TITLES.POUBELLE);
          if (binPage) {
            this.pages = [binPage].concat(this.pages.filter(page => page !== binPage));
          }
          this.bin_page_index = this.pages.findIndex(page => page.title === MENU_TITLES.POUBELLE);
          this.initFormArray(this.pages);
        });
    });
  }


  // filesystem utilities

select_node(node:FileSystemNode){
  console.log('selected',node)
}


  open_node(node: FileSystemNode): void {
    const childs: FileSystemNode | null = getChildNodes(node);
    // if (childs === null) return;
    this.current_node_childs.set(childs)
    // if node is a directory
    console.log('stack:', this.node_stack)
  }
  
  push_node(key: string, value: FileSystemNode | { __data: S3Item }) {
    // regenerate FileSystemNode from html (loop on current_node_childs() | keyvalue)
    const node: FileSystemNode = { [key]: value };
    this.open_node(node)
    if (isFolder(node)) this.node_stack.push(node);
  }

  pop_node() {
     this.node_stack.pop();
    const parent = this.node_stack[this.node_stack.length - 1];
    if(parent === null) return;
    console.log('Popping node, new current:', parent);
    this.open_node(parent);
  }

  get_icon(node: any): string {
    return node['__data'] && node['__data'].size > 0 ? 'bi bi-file' : 'bi bi-folder';
  }

  get_button_class(node: any): string {
    return node['__data'] && node['__data'].size > 0 ? 'btn btn-outline-primary' : 'btn btn-outline-secondary';
  }

  //getters

  getNextSnippetGroup(page: FormGroup): FormGroup {
    return page.get('next_snippet') as FormGroup;
  }
  get dropListIds(): string[] {
    return ['trash_'].concat(this.pageGroups.map((_, i) => 'dropList_' + i));
  }

  get pagesFormArray(): FormArray {
    return this.pagesForm.get('pagesArray') as FormArray;
  }
  get pageGroups(): FormGroup[] {
    return this.pagesFormArray.controls as FormGroup[];
  }

  is_trash_page(page: FormGroup): boolean {
    return page.get('title')?.value === MENU_TITLES.POUBELLE;
  }

  is_trash_empty(): boolean {
    const bin = this.pages.find(page => page.title === MENU_TITLES.POUBELLE);
    return bin ? bin.snippet_ids.length === 0 : false;
  }

  initFormArray(pages: Page[]): void {

    this.pagesForm = this.fb.group({
      pagesArray: this.fb.array(pages.map(page => this.fb.group({
        id: [page.id],
        title: [page.title],
        template: [page.template],
        snippet_ids: [page.snippet_ids || []],
        snippets: [page.snippets || []],
        next_snippet: this.fb.group({
          next_title: ['', Validators.required],
          next_subtitle: ['', Validators.required]
        })
      })))
    });
  }


  getPageSnippets(page: Page): Snippet[] {
    const snippets = page.snippet_ids
      .map(id => this.snippets.find(snippet => snippet.id === id))
      .filter((s): s is Snippet => s !== undefined);
    return snippets ?? [];
  }


  savePage(pageGroup: FormGroup): void {

    const isNew = pageGroup.get('id')?.value === '';
    let page: Page = {
      id: pageGroup.get('id')?.value,
      title: pageGroup.get('title')?.value,
      template: pageGroup.get('template')?.value,
      snippet_ids: pageGroup.get('snippet_ids')?.value
    };

    (isNew ? this.pageService.createPage(page) : this.pageService.updatePage(page))
      .then(() => { });
  }


  emptyBin() {
    const bin = this.pages.find(page => page.title === MENU_TITLES.POUBELLE);
    if (bin) {
      const toDelete = bin.snippets || [];
      bin.snippet_ids = [];
      delete bin.snippets;
      this.pageService.updatePage(bin).then(() => {
        this.toastService.showSuccess('Pages', 'Corbeille vidée');
        toDelete.forEach(async snippet => {
          await this.snippetService.deleteSnippet(snippet);
          console.log('Snippet deleted:', snippet.title);
        });
      });
    }
  }


  addSnippet(pageGroup: FormGroup) {
    if (!pageGroup.get('next_snippet')?.valid) { return; }
    const nextSnippetGroup = pageGroup.get('next_snippet');
    if (!nextSnippetGroup) { return; }

    const snippet: Snippet = {
      id: '',
      title: nextSnippetGroup.get('next_title') ? nextSnippetGroup.get('next_title')?.value : '',
      subtitle: nextSnippetGroup.get('next_subtitle') ? nextSnippetGroup.get('next_subtitle')?.value : '',
      content: '<p>Nouvelle vignette</p>',
      file: '',
      image: '',
      public: true,
    };
    this.snippetService.createSnippet(snippet).then((new_snippet) => {
      // this.toastService.showSuccess('Snippets', 'Snippet créé avec succès');
      pageGroup.get('snippets')?.value.push(new_snippet);
      pageGroup.get('snippet_ids')?.value.push(new_snippet.id);
      this.savePage(pageGroup);

      nextSnippetGroup.reset();

    });
  }

  onSnippetClick(snippet: Snippet) {
    this.selected_snippet = snippet || null;
    this.freeze_view_snippet.set(true);
  }

  toggleFreezeViewSnippet() {
    this.freeze_view_snippet.set(!this.freeze_view_snippet());
  }

  onHover(snippet?: Snippet) {
    if (this.selected_snippet?.id !== snippet?.id && !this.freeze_view_snippet()) {
      this.selected_snippet = snippet || null;
      // armer un timer qui etendra la visibilité du snippet
      this.view_snippet.set(true);
      setTimeout(() => {
        this.view_snippet.set(false);
      }, 5000);
    }
  }

  saveSnippetSelected() {
    if (!this.selected_snippet) return;
    this.snippetService.updateSnippet(this.selected_snippet)
      .then((updatedSnippet) => {
        this.selected_snippet = updatedSnippet;
      })
      .catch(error => {
        console.error('Error updating snippet:', error);
      });
  }


  onSnippetContentClick(snippet: Snippet) {
    const modalRef = this.modalService.open(SnippetModalEditorComponent, { centered: true });
    modalRef.componentInstance.snippet = snippet;
    modalRef.result.then((result) => {
      this.selected_snippet = result;
      this.saveSnippetSelected();
    });
  }
  // drag and drop handling

  dropSnippet(event: CdkDragDrop<Snippet[]>, pageIndex: number) {
    const originId = event.previousContainer.id; // origin dropList id
    const originPageIndex = +originId.split('_')[1]; // extract pageIndex from id
    if (event.previousContainer === event.container) {
      // Moved within the same list
      const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
      if (snippets) {
        moveItemInArray(snippets, event.previousIndex, event.currentIndex);
        this.pageGroups[pageIndex].get('snippets')?.setValue(snippets);
        this.updateSnippetList(pageIndex);
      }
    } else {
      // Moved between lists
      const originSnippets = this.pageGroups[originPageIndex].get('snippets')?.value;
      const targetSnippets = this.pageGroups[pageIndex].get('snippets')?.value;
      if (originSnippets && targetSnippets) {
        // Utilise transferArrayItem pour déplacer l'item

        transferArrayItem(
          originSnippets,
          targetSnippets,
          event.previousIndex,
          event.currentIndex
        );
        this.pageGroups[originPageIndex].get('snippets')?.setValue(originSnippets);
        this.pageGroups[pageIndex].get('snippets')?.setValue(targetSnippets);
        this.updateSnippetList(originPageIndex);
        this.updateSnippetList(pageIndex);
      }
    }
  }

  binSnippet(event: CdkDragDrop<Snippet[]>) {
    const originId = event.previousContainer.id; // origin dropList id
    const pageIndex = +originId.split('_')[1]; // extract pageIndex from id
    const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
    if (!snippets) { throw new Error('No snippets found'); }
    const binSnippets = this.pageGroups[this.bin_page_index!].get('snippets')?.value;
    if (!binSnippets) { throw new Error('No bin snippets found'); }

    const removed = snippets.splice(event.previousIndex, 1)[0];
    binSnippets.push(removed);
    this.pageGroups[pageIndex].get('snippets')?.setValue(snippets);

    this.updateSnippetList(pageIndex);
    this.updateSnippetList(this.bin_page_index!);
  }


  updateSnippetList(pageIndex: number) {
    const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
    const snippet_ids = snippets.map((s: Snippet) => s.id);
    this.pageGroups[pageIndex].get('snippet_ids')?.setValue(snippet_ids);
    this.savePage(this.pageGroups[pageIndex]);
  }


  forceScrollDown(event?: any): void {
    if (this.scrollable && this.scrollable.nativeElement) {
      const el = this.scrollable.nativeElement;
      // scroll down if near bottom or pointer near bottom
      const pointerY = event?.pointerPosition?.y ?? 0;
      const bottomEdge = el.getBoundingClientRect().bottom;
      if (
        el.scrollHeight - el.scrollTop - el.clientHeight < 60 ||
        (pointerY > bottomEdge - 60)
      ) {
        el.scrollTop = el.scrollHeight;
      }
      // scroll up if near top
      if (event && event.pointerPosition && event.pointerPosition.y - el.getBoundingClientRect().top < 60) {
        el.scrollTop = Math.max(0, el.scrollTop - 60);
      }
    }
  }
}