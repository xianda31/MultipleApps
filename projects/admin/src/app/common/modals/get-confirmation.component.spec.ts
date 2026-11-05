import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { GetConfirmationComponent } from './get-confirmation.component';

describe('GetConfirmationComponent', () => {
  it('preserves the default yes/no contract', () => {
    const activeModal = jasmine.createSpyObj<NgbActiveModal>('NgbActiveModal', ['close']);
    const component = new GetConfirmationComponent(activeModal);

    expect(component.actions).toEqual([
      { label: 'Oui', buttonClass: 'btn-primary', result: true },
      { label: 'Non', buttonClass: 'btn-primary', result: false },
    ]);

    component.respond(true);
    expect(activeModal.close).toHaveBeenCalledOnceWith(true);
  });

  it('supports explicit labels, styles and safe action first', () => {
    const activeModal = jasmine.createSpyObj<NgbActiveModal>('NgbActiveModal', ['close']);
    const component = new GetConfirmationComponent(activeModal);
    component.confirmLabel = 'Effacer et recommencer';
    component.cancelLabel = 'Reprendre le pointage';
    component.confirmButtonClass = 'btn-outline-danger';
    component.cancelButtonClass = 'btn-primary';
    component.confirmFirst = false;

    expect(component.actions).toEqual([
      { label: 'Reprendre le pointage', buttonClass: 'btn-primary', result: false },
      { label: 'Effacer et recommencer', buttonClass: 'btn-outline-danger', result: true },
    ]);
  });

  it('preserves the buttons and focus when Angular refreshes an open confirmation', () => {
    const activeModal = jasmine.createSpyObj<NgbActiveModal>('NgbActiveModal', ['close']);
    TestBed.configureTestingModule({
      imports: [GetConfirmationComponent],
      providers: [{ provide: NgbActiveModal, useValue: activeModal }],
    });
    const fixture = TestBed.createComponent(GetConfirmationComponent);
    fixture.componentInstance.confirmLabel = 'Valider les droits';
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);

    fixture.detectChanges();
    fixture.detectChanges();

    const refreshedButtons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(refreshedButtons[0]).toBe(buttons[0]);
    expect(refreshedButtons[1]).toBe(buttons[1]);
    expect(document.activeElement).toBe(buttons[0]);
    buttons[0].click();
    expect(activeModal.close).toHaveBeenCalledOnceWith(true);
  });

  it('updates labels and action order without replacing the buttons', () => {
    const activeModal = jasmine.createSpyObj<NgbActiveModal>('NgbActiveModal', ['close']);
    TestBed.configureTestingModule({
      imports: [GetConfirmationComponent],
      providers: [{ provide: NgbActiveModal, useValue: activeModal }],
    });
    const fixture = TestBed.createComponent(GetConfirmationComponent);
    fixture.detectChanges();
    const originalButtons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

    fixture.componentInstance.confirmLabel = 'Effacer et recommencer';
    fixture.componentInstance.confirmButtonClass = 'btn-outline-danger';
    fixture.componentInstance.cancelLabel = 'Reprendre le pointage';
    fixture.componentInstance.confirmFirst = false;
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons[0]).toBe(originalButtons[1]);
    expect(buttons[1]).toBe(originalButtons[0]);
    expect(buttons[0].textContent?.trim()).toBe('Reprendre le pointage');
    expect(buttons[1].textContent?.trim()).toBe('Effacer et recommencer');
    expect(buttons[1].classList.contains('btn-outline-danger')).toBeTrue();
    buttons[0].click();
    expect(activeModal.close).toHaveBeenCalledOnceWith(false);
  });
});
