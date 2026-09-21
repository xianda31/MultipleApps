import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ClipboardService } from '../../../common/services/clipboard.service';
import { CLIPBOARD_TITLE, Page, PAGE_TEMPLATES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { NavItemsService } from '../../../common/services/navitem.service';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { ToastService } from '../../../common/services/toast.service';
import { FileService } from '../../../common/services/files.service';
import { FileManager } from '../../../services/file-manager';
import { CmsWrapper } from './cms-wrapper';

describe('CmsWrapper', () => {
  let fixture: ComponentFixture<CmsWrapper>;
  let component: CmsWrapper;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CmsWrapper],
      providers: [
        {
          provide: PageService,
          useValue: {
            listPages: () => of([]),
            updatePage: jasmine.createSpy().and.callFake((page: Page) => Promise.resolve(page)),
            deletePage: jasmine.createSpy().and.resolveTo(true),
          },
        },
        {
          provide: SnippetService,
          useValue: {
            listSnippets: () => of([]),
            createSnippet: jasmine.createSpy().and.callFake((snippet: Snippet) => Promise.resolve({ ...snippet, id: 'snippet-created' })),
            updateSnippet: jasmine.createSpy().and.callFake((snippet: Snippet) => Promise.resolve(snippet)),
            readSnippet: jasmine.createSpy(),
            deleteSnippet: jasmine.createSpy().and.resolveTo(true),
          },
        },
        {
          provide: ClipboardService,
          useValue: {
            clipboardSnippets$: of([]),
            addSnippet: jasmine.createSpy().and.resolveTo(),
            removeSnippet: jasmine.createSpy().and.resolveTo(),
          },
        },
        {
          provide: ToastService,
          useValue: {
            showSuccess: jasmine.createSpy(),
            showWarning: jasmine.createSpy(),
            showError: jasmine.createSpy(),
          },
        },
        {
          provide: FileManager,
          useValue: {
            fileSelected$: of(null),
            cancelSelectionMode: () => undefined,
            getCurrentRoot: () => 'images/',
          },
        },
        {
          provide: FileService,
          useValue: {
            download_file: jasmine.createSpy().and.resolveTo(new Blob(['image'], { type: 'image/jpeg' })),
            upload_file: jasmine.createSpy().and.resolveTo(),
            getPresignedUrl$: jasmine.createSpy().and.returnValue(of('https://example.test/variant.webp')),
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

  it('hides the technical clipboard page from the page picker', () => {
    const linkedPage = { id: 'linked', title: 'Actualités', template: PAGE_TEMPLATES.PUBLICATION, snippet_ids: [] } as Page;
    const unlinkedPage = { id: 'unlinked', title: 'À préparer', template: PAGE_TEMPLATES.PUBLICATION, snippet_ids: [] } as Page;
    const clipboardPage = { id: 'clipboard', title: CLIPBOARD_TITLE, template: PAGE_TEMPLATES.PUBLICATION, snippet_ids: [] } as Page;
    component.pages = [linkedPage, unlinkedPage, clipboardPage];
    expect(component.filteredPages).toEqual([linkedPage, unlinkedPage]);
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

  it('does not save an article a second time after the editor emits it', () => {
    const snippet = { id: 'snippet-1', title: 'Titre', subtitle: 'Sous-titre' } as Snippet;
    component.pageSnippets = [{ ...snippet, subtitle: '' }];
    const snippetService = TestBed.inject(SnippetService) as jasmine.SpyObj<SnippetService>;

    component.onSnippetSaved(snippet);

    expect(component.pageSnippets[0]).toBe(snippet);
    expect(snippetService.updateSnippet).not.toHaveBeenCalled();
  });

  it('assigns the selected page as owner when creating an article', async () => {
    component.selectedPage = {
      id: 'news',
      title: 'Actualités',
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: [],
    };

    await component.addNewSnippet();

    const snippetService = TestBed.inject(SnippetService) as jasmine.SpyObj<SnippetService>;
    expect(snippetService.createSnippet).toHaveBeenCalledWith(jasmine.objectContaining({ ownerPageId: 'news' }));
  });

  it('removes a newly created article when linking it to the page fails', async () => {
    component.selectedPage = {
      id: 'news',
      title: 'Actualités',
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: [],
    };
    component.pages = [component.selectedPage];
    const pageService = TestBed.inject(PageService) as jasmine.SpyObj<PageService>;
    const snippetService = TestBed.inject(SnippetService) as jasmine.SpyObj<SnippetService>;
    pageService.updatePage.and.rejectWith(new Error('link failed'));

    await component.addNewSnippet();

    expect(snippetService.deleteSnippet).toHaveBeenCalledWith(jasmine.objectContaining({ id: 'snippet-created' }));
    expect(component.selectedPage.snippet_ids).toEqual([]);
    expect(component.pageSnippets).toEqual([]);
  });

  it('updates ownership before removing an article from the clipboard', async () => {
    component.selectedPage = {
      id: 'news',
      title: 'Actualités',
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: [],
    };
    const snippet = { id: 'snippet-1', title: 'Article' } as Snippet;

    await component.restoreSnippetFromClipboard(snippet);

    const snippetService = TestBed.inject(SnippetService) as jasmine.SpyObj<SnippetService>;
    const clipboardService = TestBed.inject(ClipboardService) as jasmine.SpyObj<ClipboardService>;
    expect(snippetService.updateSnippet).toHaveBeenCalledWith(jasmine.objectContaining({ ownerPageId: 'news' }));
    expect(clipboardService.removeSnippet).toHaveBeenCalledOnceWith(snippet.id);
    expect(component.pageSnippets).toContain(jasmine.objectContaining({ id: snippet.id, ownerPageId: 'news' }));
  });

  it('keeps a page when one of its article ownership records is inconsistent', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const page = {
      id: 'news',
      title: 'Actualités',
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: ['owned', 'foreign', 'legacy'],
    } as Page;
    const snippetService = TestBed.inject(SnippetService) as jasmine.SpyObj<SnippetService>;
    snippetService.readSnippet.and.callFake((snippetId: string) => Promise.resolve({
      id: snippetId,
      ownerPageId: snippetId === 'owned' ? page.id : snippetId === 'foreign' ? 'other-page' : undefined,
    } as Snippet));

    await component.deletePage(page);

    const clipboardService = TestBed.inject(ClipboardService) as jasmine.SpyObj<ClipboardService>;
    const pageService = TestBed.inject(PageService) as jasmine.SpyObj<PageService>;
    expect(clipboardService.addSnippet).not.toHaveBeenCalled();
    expect(pageService.deletePage).not.toHaveBeenCalled();
  });

  it('parks owned and legacy articles before deleting a page', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const page = {
      id: 'news',
      title: 'Actualités',
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: ['owned', 'legacy'],
    } as Page;
    const snippetService = TestBed.inject(SnippetService) as jasmine.SpyObj<SnippetService>;
    snippetService.readSnippet.and.callFake((snippetId: string) => Promise.resolve({
      id: snippetId,
      ownerPageId: snippetId === 'owned' ? page.id : undefined,
    } as Snippet));

    await component.deletePage(page);

    const clipboardService = TestBed.inject(ClipboardService) as jasmine.SpyObj<ClipboardService>;
    const pageService = TestBed.inject(PageService) as jasmine.SpyObj<PageService>;
    expect(clipboardService.addSnippet).toHaveBeenCalledTimes(2);
    expect(pageService.deletePage).toHaveBeenCalledOnceWith(page);
  });

  it('keeps a page when parking one of its articles fails', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const page = {
      id: 'news',
      title: 'Actualités',
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: ['owned'],
    } as Page;
    const snippetService = TestBed.inject(SnippetService) as jasmine.SpyObj<SnippetService>;
    const pageService = TestBed.inject(PageService) as jasmine.SpyObj<PageService>;
    const clipboardService = TestBed.inject(ClipboardService) as jasmine.SpyObj<ClipboardService>;
    snippetService.readSnippet.and.resolveTo({ id: 'owned', ownerPageId: page.id } as Snippet);
    clipboardService.addSnippet.and.rejectWith(new Error('parking failed'));

    await component.deletePage(page);

    expect(pageService.deletePage).not.toHaveBeenCalled();
  });

  it('imports a selected S3 image through the CMS variant pipeline', async () => {
    const snippet = {
      id: 'snippet-1',
      title: 'Article',
      public: true,
      featured: false,
    } as Snippet;
    component.pageSnippets = [snippet];
    component.mediaImageProfile = 'inline';
    component.activeSelectionSnippetId = snippet.id;

    await (component as any).applyFileSelectionToSnippet({
      path: 'legacy/photo.jpg',
      type: 'image',
      context: 'Illustration',
      targetId: snippet.id,
    });

    const fileService = TestBed.inject(FileService) as jasmine.SpyObj<FileService>;
    const uploadedFile = fileService.upload_file.calls.mostRecent().args[0] as File;
    const expectedVariant = `images/cms/snippets/snippet-1/variants/inline/${uploadedFile.name.replace(/\.[^.]+$/, '')}.webp`;
    expect(fileService.download_file).toHaveBeenCalledOnceWith('images/legacy/photo.jpg');
    expect(fileService.upload_file).toHaveBeenCalledWith(uploadedFile, 'images/cms/sources/snippet-1/inline/');
    expect(component.pageSnippets[0].image).toBe(expectedVariant);
  });

  it('waits for explicit crop validation before importing an S3 image', async () => {
    const snippet = {
      id: 'snippet-1',
      title: 'Article',
      public: true,
      featured: false,
    } as Snippet;
    component.pageSnippets = [snippet];
    component.mediaImageProfile = 'landscape-card';
    component.activeSelectionSnippetId = snippet.id;
    const fileService = TestBed.inject(FileService) as jasmine.SpyObj<FileService>;

    await (component as any).handleFileSelection({
      path: 'legacy/portrait.jpg',
      type: 'image',
      context: 'Illustration',
      targetId: snippet.id,
    });

    expect(fileService.download_file).toHaveBeenCalledOnceWith('images/legacy/portrait.jpg');
    expect(fileService.upload_file).not.toHaveBeenCalled();
    expect(component.pageSnippets[0].image).toBeUndefined();
    expect(component.mediaPreviewUrl).not.toBeNull();

    await component.confirmMediaSelection();

    expect(fileService.download_file).toHaveBeenCalledTimes(1);
    expect(fileService.upload_file).toHaveBeenCalled();
    expect(component.pageSnippets[0].image).toContain('/variants/landscape-card/');
    expect(component.mediaPreviewUrl).toBeNull();
  });

  it('does not process an already generated local variant again', async () => {
    const snippet = {
      id: 'snippet-1',
      title: 'Article',
      public: true,
      featured: false,
    } as Snippet;
    component.pageSnippets = [snippet];
    component.mediaImageProfile = 'landscape-card';
    component.mediaSelectionType = 'image';
    component.activeSelectionSnippetId = snippet.id;
    const fileService = TestBed.inject(FileService) as jasmine.SpyObj<FileService>;
    const variantPath = 'images/cms/snippets/snippet-1/variants/landscape-card/asset.webp';

    component.onMediaUploaded([variantPath]);
    await fixture.whenStable();

    expect(fileService.download_file).not.toHaveBeenCalled();
    expect(fileService.upload_file).not.toHaveBeenCalled();
    expect(component.pageSnippets[0].image).toBe(variantPath);
  });
});