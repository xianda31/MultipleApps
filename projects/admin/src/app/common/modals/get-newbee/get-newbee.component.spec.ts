import { FormBuilder } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { GetNewbeeComponent } from './get-newbee.component';

describe('GetNewbeeComponent', () => {
  function buildComponent() {
    const activeModal = jasmine.createSpyObj<NgbActiveModal>('NgbActiveModal', ['close']);
    return {
      component: new GetNewbeeComponent(activeModal, new FormBuilder()),
      activeModal,
    };
  }

  it('requires one valid email and leaves mailing consent disabled by default', () => {
    const { component } = buildComponent();

    component.newbee.patchValue({
      gender: 'F',
      firstname: 'Alice',
      lastname: 'Martin',
    });

    expect(component.newbee.invalid).toBeTrue();
    expect(component.newbee.value.acceptMailing).toBeFalse();
    component.newbee.patchValue({ email: 'alice@example.fr' });
    expect(component.newbee.valid).toBeTrue();
  });

  it('normalizes the email and returns explicit mailing consent', () => {
    const { component, activeModal } = buildComponent();
    component.newbee.setValue({
      gender: 'F',
      firstname: 'Alice',
      lastname: 'Martin',
      email: ' Alice@Example.FR ',
      phone: '',
      city: '',
      acceptMailing: true,
    });

    component.got_it();

    expect(activeModal.close).toHaveBeenCalledWith(jasmine.objectContaining({
      email: 'alice@example.fr',
      acceptMailing: true,
    }));
  });
});
