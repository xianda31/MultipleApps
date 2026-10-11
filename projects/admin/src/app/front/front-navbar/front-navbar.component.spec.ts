import { FrontNavbarComponent } from './front-navbar.component';

describe('FrontNavbarComponent', () => {
  it('opens an external redirect before closing the menu', () => {
    const component = new FrontNavbarComponent();
    const event = jasmine.createSpyObj<MouseEvent>('MouseEvent', ['preventDefault']);
    const dropdown = jasmine.createSpyObj<{ close(): void }>('dropdown', ['close']);
    const openSpy = spyOn(window, 'open');
    const url = 'https://www.bridgeplus.com/nos-simultanes/resultats/?res=sim';

    component.openExternalRedirect(url, event, dropdown);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(dropdown.close).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledOnceWith(url, '_blank', 'noopener');
  });
});
