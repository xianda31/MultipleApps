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

  it('warns when the source must be enlarged for the target profile', () => {
    fixture.componentRef.setInput('sourceWidth', 133);
    fixture.componentRef.setInput('sourceHeight', 163);
    fixture.detectChanges();

    const warning = fixture.nativeElement.querySelector('.cms-image-review__resolution-warning');
    expect(warning.textContent).toContain('Résolution insuffisante : 133 × 163 px');
    expect(warning.textContent).toContain('600 × 800 px');
    expect(warning.textContent).toContain('risque d’être pixelisé');
  });

  it('shows the original and the final crop preview', () => {
    fixture.componentRef.setInput('sourceWidth', 1600);
    fixture.componentRef.setInput('sourceHeight', 900);
    fixture.detectChanges();

    const captions = Array.from<Element>(fixture.nativeElement.querySelectorAll('figcaption'))
      .map((caption: Element) => caption.textContent?.trim());
    const sourceFrame = fixture.nativeElement.querySelector('.cms-image-review__source') as HTMLElement;
    const finalImage = fixture.nativeElement.querySelector('.cms-image-review__frame img') as HTMLImageElement;

    expect(captions).toEqual(['Source originale', 'Rendu final utilisé sur le site']);
    expect(sourceFrame.style.aspectRatio).toBe('1600 / 900');
    expect(finalImage.style.objectFit).toBe('cover');
    expect(finalImage.style.objectPosition).toBe('center center');
    expect(fixture.nativeElement.textContent).toContain('600 × 800 px · ratio 3:4');
    expect(fixture.nativeElement.textContent).not.toContain('Poids final');
    expect(fixture.componentInstance.cropDescription)
      .toBe('Rognage : L 57,8 % · H 0 %');
  });

  it('reports vertical crop for a portrait source targeting a landscape frame', () => {
    fixture.componentRef.setInput('profile', 'landscape-card');
    fixture.componentRef.setInput('sourceWidth', 900);
    fixture.componentRef.setInput('sourceHeight', 1600);
    fixture.detectChanges();

    expect(fixture.componentInstance.cropDescription)
      .toBe('Rognage : L 0 % · H 62,5 %');
  });
});
