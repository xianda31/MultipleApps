import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CmsWrapper } from './cms-wrapper';

describe('CmsWrapper', () => {
  let component: CmsWrapper;
  let fixture: ComponentFixture<CmsWrapper>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CmsWrapper]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CmsWrapper);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
