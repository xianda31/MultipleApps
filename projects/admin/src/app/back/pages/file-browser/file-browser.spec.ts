import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileBrowser } from './file-browser';

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
});
