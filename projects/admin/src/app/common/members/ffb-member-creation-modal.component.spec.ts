import { FormBuilder } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FfbMemberCreationModalComponent } from './ffb-member-creation-modal.component';

describe('FfbMemberCreationModalComponent', () => {
  function buildComponent(email = '') {
    const activeModal = jasmine.createSpyObj<NgbActiveModal>('NgbActiveModal', ['close']);
    const component = new FfbMemberCreationModalComponent(activeModal, new FormBuilder());
    component.clubMember = {
      id: 123,
      firstName: 'Alice',
      lastName: 'MARTIN',
      license_number: '00123456',
    } as any;
    component.person = { email, city: 'Toulouse' } as any;
    component.ngOnInit();
    return { component, activeModal };
  }

  it('prefills a normalized FFB email without granting mailing consent', () => {
    const { component } = buildComponent(' Alice@Example.FR ');

    expect(component.form.getRawValue()).toEqual({
      email: 'alice@example.fr',
      acceptMailing: false,
    });
  });

  it('requires an email and returns the explicit consent choice', () => {
    const { component, activeModal } = buildComponent();

    component.confirm();
    expect(activeModal.close).not.toHaveBeenCalled();

    component.form.setValue({ email: 'alice@example.fr', acceptMailing: true });
    component.confirm();
    expect(activeModal.close).toHaveBeenCalledWith({
      email: 'alice@example.fr',
      acceptMailing: true,
    });
  });
});
