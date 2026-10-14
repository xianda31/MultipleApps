import {
  changeLogAreasForSite,
  generateChangeLogId,
  sortChangeLogEntries,
  validateChangeLogEntries,
} from './change-log.model';

describe('change log model', () => {
  it('validates and sorts entries from newest to oldest', () => {
    const entries = validateChangeLogEntries([
      {
        id: '2026-10-13-export-membres',
        publishedOn: '2026-10-13',
        site: 'BACK_OFFICE',
        area: 'ADHERENTS',
        kind: 'NEW',
        summary: 'Le répertoire peut être exporté.',
      },
      {
        id: '2026-10-14-achat-zero',
        publishedOn: '2026-10-14',
        site: 'FRONT',
        area: 'BOUTIQUE',
        kind: 'IMPROVEMENT',
        summary: 'Les achats couverts peuvent être validés.',
      },
    ]);

    expect(sortChangeLogEntries(entries).map((entry) => entry.id)).toEqual([
      '2026-10-14-achat-zero',
      '2026-10-13-export-membres',
    ]);
  });

  it('rejects duplicate identifiers and invalid dates', () => {
    expect(() => validateChangeLogEntries([
      {
        id: 'duplicate',
        publishedOn: '2026-02-30',
        site: 'BACK_OFFICE',
        area: 'GENERAL',
        kind: 'FIX',
        summary: 'Première entrée.',
      },
      {
        id: 'duplicate',
        publishedOn: '2026-10-14',
        site: 'BACK_OFFICE',
        area: 'GENERAL',
        kind: 'FIX',
        summary: 'Deuxième entrée.',
      },
    ])).toThrow();
  });

  it('generates a readable unique identifier', () => {
    const id = generateChangeLogId(
      '2026-10-14',
      'L’adhésion est signalée à partir du mois configuré.',
      new Set(['2026-10-14-l-adhesion-est-signalee-a-partir-du']),
    );

    expect(id).toBe('2026-10-14-l-adhesion-est-signalee-a-partir-du-2');
  });

  it('defaults legacy entries without a site to the back office', () => {
    const [entry] = validateChangeLogEntries([{
      id: '2026-10-01-ancienne-entree',
      publishedOn: '2026-10-01',
      area: 'GENERAL',
      kind: 'FIX',
      summary: 'Une ancienne entrée reste lisible.',
    }]);

    expect(entry.site).toBe('BACK_OFFICE');
  });

  it('exposes distinct areas for each site', () => {
    expect(changeLogAreasForSite('FRONT').find((area) => area.value === 'BOUTIQUE')?.label)
      .toBe('Boutique en ligne');
    expect(changeLogAreasForSite('BACK_OFFICE').map((area) => area.value)).toContain('BOUTIQUE');
    expect(changeLogAreasForSite('BACK_OFFICE').find((area) => area.value === 'BOUTIQUE')?.label)
      .toBe('Boutique');
  });

  it('rejects an area that does not belong to the selected site', () => {
    expect(() => validateChangeLogEntries([{
      id: '2026-10-14-rubrique-incompatible',
      publishedOn: '2026-10-14',
      site: 'FRONT',
      area: 'ADHERENTS',
      kind: 'FIX',
      summary: 'Cette rubrique ne correspond pas au site.',
    }])).toThrowError(/incompatible avec le site FRONT/);
  });
});
