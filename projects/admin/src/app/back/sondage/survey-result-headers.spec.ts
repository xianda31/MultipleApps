import { resultHeaders, truncateColumnTitle } from './survey-result-headers';

describe('survey result headers', () => {
  const option = { value: 'yes', label: 'Oui, je viens', nextAction: 'NEXT' as const };

  it('uses defaults and only adds list or comment headers when the question uses them', () => {
    expect(resultHeaders({ text: 'Présence', options: [option] })).toEqual(['Présence']);
    expect(resultHeaders({
      text: 'Serez-vous présent au repas de Noël ?',
      options: [{ ...option, detailOptions: [{ value: 'm1', label: 'DUPONT Jean' }], commentEnabled: true }],
    })).toEqual(['Serez-vous présent...', 'Valeur choisie', 'Commentaire']);
  });

  it('prefers the names typed in the editor', () => {
    expect(resultHeaders({
      text: 'Serez-vous présent ?', resultLabel: ' Présence ', detailResultLabel: 'Mandataire', commentResultLabel: 'Précision',
      options: [{ ...option, detailOptions: [{ value: 'm1', label: 'DUPONT Jean' }], commentEnabled: true }],
    })).toEqual(['Présence', 'Mandataire', 'Précision']);
  });

  it('truncates a long question at the nearest word', () => {
    expect(truncateColumnTitle('Participation assemblée générale')).toBe('Participation...');
    expect(truncateColumnTitle('Court')).toBe('Court');
  });
});
