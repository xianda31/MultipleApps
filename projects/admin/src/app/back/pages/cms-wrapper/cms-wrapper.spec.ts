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
        { provide: PageService, useValue: { listPages: () => of([]) } },
        { provide: SnippetService, useValue: { listSnippets: () => of([]), updateSnippet: jasmine.createSpy().and.resolveTo() } },
        { provide: ClipboardService, useValue: { clipboardSnippets$: of([]) } },
        { provide: ToastService, useValue: {} },
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