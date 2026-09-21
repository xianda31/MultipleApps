import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileBrowser } from './file-browser';
import { FileManager } from '../../../services/file-manager';
import { SnippetService } from '../../../common/services/snippet.service';
import { ToastService } from '../../../common/services/toast.service';

describe('FileBrowser', () => {
  let component: FileBrowser;
  let fixture: ComponentFixture<FileBrowser>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileBrowser]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileBrowser);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('preserves a root selected before the browser opens', () => {
    const fileManager = TestBed.inject(FileManager);
    fixture.destroy();
    fileManager.activateSelectionMode({ type: 'document', context: 'test' });

    fixture = TestBed.createComponent(FileBrowser);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.currentRoot).toBe('documents/');
  });

  it('does not delete a file referenced by an article', async () => {
    const fileManager = TestBed.inject(FileManager);
    const snippetService = TestBed.inject(SnippetService);
    const toastService = TestBed.inject(ToastService);
    const deleteFile = spyOn(fileManager, 'deleteFile').and.resolveTo();
    spyOn(snippetService, 'listAllSnippetsStrict').and.resolveTo([
      { id: 'snippet-1', image: 'images/shared/photo.webp' } as any,
    ]);
    const warning = spyOn(toastService, 'showWarning');
    spyOn(window, 'confirm').and.returnValue(true);
    component.currentRoot = 'images/';
    component.currentPath = 'shared/photo.webp';
    spyOn(component, 'isCurrentPathAFolder').and.returnValue(false);

    await component.deleteCurrentFile();

    expect(deleteFile).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith('Suppression impossible', 'Ce média est encore utilisé par 1 article(s).');
  });
});
