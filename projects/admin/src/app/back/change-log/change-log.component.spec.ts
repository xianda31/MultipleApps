import { ChangeLogDataService } from './change-log-data.service';
import { ChangeLogComponent } from './change-log.component';
import { ChangeLogEntry } from './change-log.model';

describe('ChangeLogComponent', () => {
  const entries: ChangeLogEntry[] = [
    {
      id: '2026-10-14-front-boutique',
      publishedOn: '2026-10-14',
      site: 'FRONT',
      area: 'BOUTIQUE',
      kind: 'IMPROVEMENT',
      summary: 'Achat en ligne amélioré.',
    },
    {
      id: '2026-10-14-back-tournois',
      publishedOn: '2026-10-14',
      site: 'BACK_OFFICE',
      area: 'TOURNOIS',
      kind: 'NEW',
      summary: 'Nouveau signalement dans les tournois.',
    },
  ];

  function createComponent(): ChangeLogComponent {
    const service = {
      getPublishedEntries: () => entries,
    } as ChangeLogDataService;
    return new ChangeLogComponent(service);
  }

  it('combines site, area and kind filters', () => {
    const component = createComponent();
    component.selectedSite = 'FRONT';
    component.selectedArea = 'BOUTIQUE';
    component.selectedKind = 'IMPROVEMENT';

    expect(component.filteredEntries.map((entry) => entry.id)).toEqual([
      '2026-10-14-front-boutique',
    ]);
  });

  it('resets all filters', () => {
    const component = createComponent();
    component.selectedSite = 'BACK_OFFICE';
    component.selectedArea = 'TOURNOIS';
    component.selectedKind = 'NEW';

    component.resetFilters();

    expect(component.selectedSite).toBe('');
    expect(component.selectedArea).toBe('');
    expect(component.selectedKind).toBe('');
    expect(component.filteredEntries).toEqual(entries);
  });

  it('clears an area filter that does not belong to the selected site', () => {
    const component = createComponent();
    component.selectedArea = 'TOURNOIS';
    component.selectedSite = 'FRONT';

    component.onSiteFilterChange();

    expect(component.selectedArea).toBe('');
    expect(component.availableAreas.map((area) => area.value)).toContain('TOURNOIS_COMPETITIONS');
  });
});
