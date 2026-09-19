import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileBrowser } from './file-browser';
import { FileManager } from '../../../services/file-manager';

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
});
