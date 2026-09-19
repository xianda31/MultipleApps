import { ComponentFixture, TestBed } from '@angular/core/testing';

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
});
