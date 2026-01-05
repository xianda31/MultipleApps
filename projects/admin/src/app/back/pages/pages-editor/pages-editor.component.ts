import { Component, ChangeDetectorRef, NgZone } from '@angular/core';
import { PageService } from '../../../common/services/page.service';
import { Page, PAGE_TEMPLATES } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { PageEditorComponent } from '../page-editor/page-editor.component';
import { Observable, BehaviorSubject } from 'rxjs';
import { ToastService } from '../../../common/services/toast.service';


@Component({
  selector: 'app-pages-editor',
  standalone: true,
  imports: [CommonModule, PageEditorComponent],
  templateUrl: './pages-editor.component.html',
  styleUrl: './pages-editor.component.scss'
})
export class PagesEditorComponent {
  pages: Page[] = [];
  selected_page: Page | null = null;
  private selectedPageSubject = new BehaviorSubject<Page | null>(null);
  selectedPage$: Observable<Page | null> = this.selectedPageSubject.asObservable();

  constructor(
    private pageService: PageService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private toastService: ToastService
  ) {}

  async ngOnInit() {
    await this.loadPages();
  }

  async loadPages() {
    this.pageService.listPages().subscribe((pages: Page[]) => {
      this.pages = pages;
    });
  }

  selectPage(page: Page) {
    this.selected_page = page;
    this.selectedPageSubject.next(page);
  }

  async newPage() {
    const newPage: Page = {
      id: 'page_' + Date.now(),
      title: 'Nouvelle page',
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: [] // Nouvelle page commence vide
    };
    
    try {
      const created = await this.pageService.createPage(newPage);
      this.pages.push(created);
      this.selectPage(created);
      this.toastService.showSuccess('Pages', 'Nouvelle page créée');
      this.cdr.detectChanges();
    } catch (error) {
      this.toastService.showErrorToast('Pages', 'Erreur lors de la création de la page');
      console.error('Error creating page:', error);
    }
  }

  deletePage(page: Page) {
    // Implementation needed
  }

  forceUpdate() {
    this.cdr.detectChanges();
  }
}