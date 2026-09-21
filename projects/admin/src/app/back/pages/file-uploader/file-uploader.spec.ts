import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FileUploader } from './file-uploader';

describe('FileUploader', () => {
  let component: FileUploader;
  let fixture: ComponentFixture<FileUploader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileUploader]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileUploader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses a contextual target path when provided', () => {
    component.targetPathOverride = 'images/cms/snippets/snippet-1/images';

    expect(component.getFullTargetPath()).toBe('images/cms/snippets/snippet-1/images/');
  });

  it('keeps album thumbnails in the contextual snippet folder', () => {
    component.targetPathOverride = 'albums/cms/snippets/snippet-1/album';

    expect(component.getAlbumThumbnailPath()).toBe('thumbnails/albums/cms/snippets/snippet-1/album/');
  });

  it('recognizes the albums root with or without a trailing slash', () => {
    component.currentRoot = 'albums';
    expect(component.isAlbumMode).toBeTrue();

    component.currentRoot = 'albums/';
    expect(component.isAlbumMode).toBeTrue();
  });

  it('enables native multiple selection in album mode', () => {
    component.currentRoot = 'albums/';

    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.multiple).toBeTrue();
  });

  it('shows the automatic album review instead of the selectable file list', () => {
    component.currentRoot = 'albums';
    component.selectedFiles = [new File(['image'], 'photo.jpg', { type: 'image/jpeg' })];

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.album-review')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.file-list')).toBeNull();
  });

  it('emits the generated WebP variant after a contextual CMS upload', async () => {
    component.imageProfile = 'landscape-card';
    component.targetPathOverride = 'images/cms/sources/snippet-1/landscape-card/';
    const source = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    (component as any).selectedOriginals.add(source);

    spyOn(component.fileManager, 'addFilesToUpload');
    spyOn(component.fileManager, 'uploadFiles').and.resolveTo();
    const variantLookup = spyOn((component as any).fileService, 'getPresignedUrl$')
      .and.returnValue(of('https://example.test/variant.webp'));
    const emitted = jasmine.createSpy('uploaded');
    component.uploaded.subscribe(emitted);

    await component.uploadFiles();

    const uploadedFiles = (component.fileManager.addFilesToUpload as jasmine.Spy).calls.mostRecent().args[1] as File[];
    const variantPath = `images/cms/snippets/snippet-1/variants/landscape-card/${uploadedFiles[0].name.replace(/\.[^.]+$/, '')}.webp`;
    expect(variantLookup).toHaveBeenCalledOnceWith(variantPath, true, true);
    expect(emitted).toHaveBeenCalledOnceWith([variantPath]);
  });
});
