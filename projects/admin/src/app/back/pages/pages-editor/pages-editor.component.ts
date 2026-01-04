import { Component, ChangeDetectorRef, NgZone } from '@angular/core';
import { PageService } from '../../../common/services/page.service';
import { Page } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { PageEditorComponent } from '../page-editor/page-editor.component';
import { Observable, BehaviorSubject } from 'rxjs';


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
    private ngZone: NgZone
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

  newPage() {
    // Implementation needed
  }

  deletePage(page: Page) {
    // Implementation needed
  }

  forceUpdate() {
    this.cdr.detectChanges();
  }
}