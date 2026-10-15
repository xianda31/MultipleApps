import { FFB_proxyService } from '../services/ffb.service';
import { InputPlayerComponent } from './input-player.component';

describe('InputPlayerComponent', () => {
  let searchPlayersSuchAs: jasmine.Spy;
  let component: InputPlayerComponent;

  beforeEach(() => {
    jasmine.clock().install();
    searchPlayersSuchAs = jasmine.createSpy().and.resolveTo({
      items: [],
      totalItems: 0,
      totalPages: 1,
      currentPage: 1,
    });
    component = new InputPlayerComponent({
      searchPlayersSuchAs,
    } as unknown as FFB_proxyService);
    component.groupSessionId = 338081;
  });

  afterEach(() => {
    component.ngOnDestroy();
    jasmine.clock().uninstall();
  });

  it('debounces searches and passes the group session context', () => {
    component.onSearchChange('  CLEMENT   Jocelyne ');

    jasmine.clock().tick(299);
    expect(searchPlayersSuchAs).not.toHaveBeenCalled();

    jasmine.clock().tick(1);
    expect(searchPlayersSuchAs).toHaveBeenCalledOnceWith(
      'CLEMENT Jocelyne',
      { groupSessionId: 338081 }
    );
  });

  it('only sends the latest value entered during the debounce window', () => {
    component.onSearchChange('CLEM');
    jasmine.clock().tick(200);
    component.onSearchChange('CLEMENT Jocelyne');
    jasmine.clock().tick(300);

    expect(searchPlayersSuchAs).toHaveBeenCalledOnceWith(
      'CLEMENT Jocelyne',
      { groupSessionId: 338081 }
    );
  });
});
