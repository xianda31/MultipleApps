import { FormBuilder } from '@angular/forms';
import { ClubMember } from '../ffb/interface/club-member.interface';
import { AddDirectoryPersonModalComponent } from './add-directory-person-modal.component';

describe('AddDirectoryPersonModalComponent', () => {
  function createComponent() {
    const activeModal = jasmine.createSpyObj('NgbActiveModal', ['close']);
    const ffbService = jasmine.createSpyObj('FFBProxyService', ['getFFBPerson']);
    const component = new AddDirectoryPersonModalComponent(activeModal, new FormBuilder(), ffbService);
    return { component, activeModal, ffbService };
  }

  it('returns a manually entered person', () => {
    const { component, activeModal } = createComponent();
    component.mode = 'manual';
    component.manualForm.setValue({
      gender: 'F',
      firstname: 'Alice',
      lastname: 'Martin',
      email: ' Alice@example.fr ',
      phone: '0102030405',
      city: 'Toulouse',
      acceptMailing: true,
    });

    component.confirm();

    expect(activeModal.close).toHaveBeenCalledWith({
      kind: 'manual',
      member: jasmine.objectContaining({
        firstname: 'Alice',
        lastname: 'Martin',
        email: 'alice@example.fr',
        acceptMailing: true,
      }),
    });
  });

  it('returns the selected FFB person with contact preferences', async () => {
    const { component, activeModal, ffbService } = createComponent();
    const player = {
      id: 123,
      license_number: '01234567',
      firstName: 'Alice',
      lastName: 'MARTIN',
      club: { label: 'Bridge Club de Toulouse' },
    } as ClubMember;
    const person = {
      email: 'alice@example.fr',
      city: 'Toulouse',
    };
    ffbService.getFFBPerson.and.resolveTo(person);

    await component.onFfbPlayerChange(player);
    component.ffbForm.patchValue({ acceptMailing: true });
    component.confirm();

    expect(activeModal.close).toHaveBeenCalledWith({
      kind: 'ffb',
      player,
      person,
      email: 'alice@example.fr',
      acceptMailing: true,
    });
  });
});
