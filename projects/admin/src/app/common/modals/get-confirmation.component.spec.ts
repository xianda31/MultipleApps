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
});
