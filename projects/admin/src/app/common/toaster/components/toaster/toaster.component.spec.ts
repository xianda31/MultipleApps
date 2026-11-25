import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ToastService } from '../../../services/toast.service';
import { ToasterComponent } from './toaster.component';

describe('ToasterComponent', () => {
  it('keeps persistent warnings until dismissed while ordinary warnings expire', fakeAsync(() => {
    TestBed.configureTestingModule({ imports: [ToasterComponent] });
    const fixture = TestBed.createComponent(ToasterComponent);
    fixture.detectChanges();
    const service = TestBed.inject(ToastService);
    service.showWarning('À vérifier', 'Règlement à vérifier', true);
    service.showWarning('Information', 'Avertissement ordinaire');
    fixture.detectChanges();
    tick(7000);
    fixture.detectChanges();

    expect(fixture.componentInstance.currentToasts.map(toast => toast.title)).toEqual(['À vérifier']);
    const close = fixture.nativeElement.querySelector('.btn-close') as HTMLButtonElement;
    close.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.currentToasts.length).toBe(0);
    fixture.destroy();
  }));
});
