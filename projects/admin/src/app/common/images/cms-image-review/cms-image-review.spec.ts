import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CmsImageReview } from './cms-image-review';

describe('CmsImageReview', () => {
  let fixture: ComponentFixture<CmsImageReview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CmsImageReview] }).compileComponents();
    fixture = TestBed.createComponent(CmsImageReview);
    fixture.componentRef.setInput('profile', 'portrait-card');
    fixture.componentRef.setInput('sourceUrl', 'data:image/jpeg;base64,preview');
  });

  it('warns when a landscape source targets a portrait renderer', () => {
    fixture.componentRef.setInput('sourceWidth', 1600);
    fixture.componentRef.setInput('sourceHeight', 900);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Source paysage pour un cadre portrait');
    expect(fixture.nativeElement.textContent).toContain('600 × 800 px');
  });

  it('does not warn for a matching source orientation', () => {
    fixture.componentRef.setInput('sourceWidth', 900);
    fixture.componentRef.setInput('sourceHeight', 1600);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
});
