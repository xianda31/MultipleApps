import { ChangeLogDataService } from './change-log-data.service';
import { ChangeLogEditorComponent } from './change-log-editor.component';

describe('ChangeLogEditorComponent', () => {
  function createComponent(): ChangeLogEditorComponent {
    return new ChangeLogEditorComponent({} as ChangeLogDataService);
  }

  it('offers only the areas for the selected site', () => {
    const component = createComponent();
    component.form.controls.site.setValue('FRONT');

    expect(component.availableAreas.find((area) => area.value === 'BOUTIQUE')?.label)
      .toBe('Boutique en ligne');
    expect(component.availableAreas.map((area) => area.value)).not.toContain('ADHERENTS');
  });

  it('resets an incompatible area when the site changes', () => {
    const component = createComponent();
    component.form.controls.area.setValue('ADHERENTS');
    component.form.controls.site.setValue('FRONT');

    component.onSiteChange();

    expect(component.form.controls.area.value).toBe('GENERAL');
  });
});
