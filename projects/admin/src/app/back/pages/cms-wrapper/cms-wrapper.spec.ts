import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ClipboardService } from '../../../common/services/clipboard.service';
import { CLIPBOARD_TITLE, Page, PAGE_TEMPLATES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { NavItemsService } from '../../../common/services/navitem.service';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { ToastService } from '../../../common/services/toast.service';
import { FileManager } from '../../../services/file-manager';
import { CmsWrapper } from './cms-wrapper';

describe('CmsWrapper', () => {
  let fixture: ComponentFixture<CmsWrapper>;
  let component: CmsWrapper;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CmsWrapper],
      providers: [
        { provide: PageService, useValue: { listPages: () => of([]) } },
        { provide: SnippetService, useValue: { listSnippets: () => of([]) } },
        { provide: ClipboardService, useValue: { clipboardSnippets$: of([]) } },
        { provide: ToastService, useValue: {} },
        {
          provide: FileManager,
          useValue: {
            fileSelected$: of(null),
            cancelSelectionMode: () => undefined,
          },
        },
        {
          provide: NavItemsService,
          useValue: {
            loadNavItemsSandbox: () => of([]),
            loadNavItemsProduction: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CmsWrapper);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the master-detail workspace', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.cms-workspace')).not.toBeNull();
  });

  it('shows the active page like a page-list entry without a search field', () => {
    component.selectedPage = {
      id: 'albums',
      title: 'Albums',
      template: PAGE_TEMPLATES.ALBUMS,
      snippet_ids: [],
    };
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector('.active-page-summary');
    expect(summary.querySelector('span').textContent).toContain('Albums');
    expect(summary.querySelector('small').textContent).toContain(PAGE_TEMPLATES.ALBUMS);
    expect(summary.querySelector('i').getAttribute('aria-label')).toBe('Hors navigation');
    expect(fixture.nativeElement.querySelector('input[type="search"]')).toBeNull();
  });

  it('filters linked pages and hides the technical clipboard page', () => {
    const linkedPage = { id: 'linked', title: 'Actualités', template: PAGE_TEMPLATES.PUBLICATION, snippet_ids: [] } as Page;
    const unlinkedPage = { id: 'unlinked', title: 'À préparer', template: PAGE_TEMPLATES.PUBLICATION, snippet_ids: [] } as Page;
    const clipboardPage = { id: 'clipboard', title: CLIPBOARD_TITLE, template: PAGE_TEMPLATES.PUBLICATION, snippet_ids: [] } as Page;
    component.pages = [linkedPage, unlinkedPage, clipboardPage];
    component.linkedPageIds = new Set([linkedPage.id]);

    component.pageFilter = 'linked';
    expect(component.filteredPages).toEqual([linkedPage]);

    component.pageFilter = 'unlinked';
    expect(component.filteredPages).toEqual([unlinkedPage]);
  });

  it('marks an album article without a folder as incomplete', () => {
    component.selectedPage = {
      id: 'albums',
      title: 'Albums',
      template: PAGE_TEMPLATES.ALBUMS,
      snippet_ids: ['snippet-1'],
    };
    const snippet = {
      id: 'snippet-1',
      title: 'Sortie du club',
      subtitle: '',
      content: '',
      public: true,
      featured: false,
      image: '',
      file: '',
      folder: '',
    } as Snippet;

    expect(component.isSnippetComplete(snippet)).toBeFalse();
    expect(component.isSnippetComplete({ ...snippet, folder: 'albums/sortie/' })).toBeTrue();
  });
});