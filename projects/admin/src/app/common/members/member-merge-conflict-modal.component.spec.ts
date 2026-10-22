import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MemberMergeConflictModalComponent } from './member-merge-conflict-modal.component';

describe('MemberMergeConflictModalComponent', () => {
  function buildComponent() {
    const activeModal = jasmine.createSpyObj<NgbActiveModal>('NgbActiveModal', ['close']);
    const component = new MemberMergeConflictModalComponent(activeModal);
    component.conflict = {
      clubMember: {
        id: 277263,
        firstName: 'Françoise',
        lastName: 'RAMOS',
        license_number: '24827406',
      } as any,
      person: null,
      candidates: [{
        id: 'historical-member',
        firstname: 'Françoise',
        lastname: 'RAMOS',
      } as any],
    };
    return { component, activeModal };
  }

  it('requires an explicit candidate selection before returning a merge decision', () => {
    const { component, activeModal } = buildComponent();

    component.merge();
    expect(activeModal.close).not.toHaveBeenCalled();

    component.selectedMemberId = 'historical-member';
    component.merge();
    expect(activeModal.close).toHaveBeenCalledWith({
      action: 'merge',
      memberId: 'historical-member',
    });
  });

  it('supports creating an homonym or deferring the decision', () => {
    const { component, activeModal } = buildComponent();

    component.createDistinct();
    component.defer();

    expect(activeModal.close).toHaveBeenCalledWith({ action: 'create' });
    expect(activeModal.close).toHaveBeenCalledWith({ action: 'defer' });
  });

  it('formats the FFB birthdate for French display', () => {
    const { component } = buildComponent();

    expect(component.formatBirthdate('1956-07-06T00:00:00+01:00')).toBe('06/07/1956');
    expect(component.formatBirthdate(undefined)).toBe('—');
  });
});
