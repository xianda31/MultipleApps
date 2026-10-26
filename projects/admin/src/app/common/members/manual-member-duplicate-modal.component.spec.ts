import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ManualMemberDuplicateModalComponent } from './manual-member-duplicate-modal.component';

describe('ManualMemberDuplicateModalComponent', () => {
  it('requires an explicit create or cancel decision', () => {
    const activeModal = jasmine.createSpyObj<NgbActiveModal>('NgbActiveModal', ['close']);
    const component = new ManualMemberDuplicateModalComponent(activeModal);

    component.createDistinct();
    component.cancel();

    expect(activeModal.close).toHaveBeenCalledWith(true);
    expect(activeModal.close).toHaveBeenCalledWith(false);
  });
});
