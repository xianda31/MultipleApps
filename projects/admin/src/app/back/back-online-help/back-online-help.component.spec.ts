import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Group_names } from '../../common/authentification/group.interface';
import { GroupService } from '../../common/authentification/group.service';
import { BackOnlineHelpComponent } from './back-online-help.component';
import { HelpTopic } from './back-online-help-content';

describe('BackOnlineHelpComponent blocks', () => {
  let fixture: ComponentFixture<BackOnlineHelpComponent>;
  let component: BackOnlineHelpComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BackOnlineHelpComponent],
      providers: [
        provideRouter([]),
        {
          provide: GroupService,
          useValue: {
            getCurrentUserGroups: async () => [Group_names.Member],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BackOnlineHelpComponent);
    component = fixture.componentInstance;
  });

  it('renders every block type in order with chapter children and own content', () => {
    const topic: HelpTopic = {
      id: 'test-chapter',
      title: 'Chapitre test',
      summary: 'Résumé de navigation',
      scope: 'general',
      contentStatus: 'published',
      nav: {
        icon: 'bi-test',
        groupLevel: 'Membre',
      },
      illustrations: [
        {
          id: 'schema-test',
          path: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
          alt: 'Schéma de test',
        },
      ],
      blocks: [
        {
          id: 'texte',
          type: 'text',
          title: 'Texte',
          paragraphs: ['Paragraphe rendu'],
        },
        {
          id: 'liste',
          type: 'list',
          title: 'Liste',
          items: ['Élément rendu'],
        },
        {
          id: 'procedure',
          type: 'procedure',
          title: 'Procédure',
          steps: ['Étape rendue'],
        },
        {
          id: 'illustration',
          type: 'illustration',
          illustrationId: 'schema-test',
          illustration: {
            id: 'schema-test',
            path: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
            alt: 'Schéma de test',
          },
          caption: 'Légende rendue',
        },
        {
          id: 'tableau',
          type: 'table',
          title: 'Tableau',
          columns: ['Colonne A', 'Colonne B'],
          rows: [['Cellule A', 'Cellule B']],
        },
        {
          id: 'attention',
          type: 'attention',
          title: 'Attention',
          messages: ['Message rendu'],
        },
      ],
      children: [
        {
          id: 'test-child',
          title: 'Sous-rubrique test',
          summary: 'Résumé enfant',
          nav: {
            icon: 'bi-test',
            groupLevel: 'Membre',
          },
          blocks: [],
        },
      ],
    };
    component.selectedMenuTopic = topic;
    component.selectedDetailTopic = topic;

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    for (const expected of [
      'Sous-rubrique test',
      'Paragraphe rendu',
      'Élément rendu',
      'Étape rendue',
      'Légende rendue',
      'Colonne A',
      'Cellule B',
      'Message rendu',
    ]) {
      expect(text).withContext(`Missing rendered content: ${expected}`).toContain(expected);
    }
    expect(fixture.nativeElement.querySelector('.table-responsive')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('img[alt="Schéma de test"]')).not.toBeNull();

    const renderedBlockText = Array.from(
      fixture.nativeElement.querySelectorAll('.back-help__block, .back-help__illustration'),
    ).map((element: unknown) => (element as HTMLElement).textContent?.trim());
    expect(renderedBlockText).toEqual([
      'TexteParagraphe rendu',
      'ListeÉlément rendu',
      'ProcédureÉtape rendue',
      'Légende rendue',
      'TableauColonne AColonne BCellule ACellule B',
      'AttentionMessage rendu',
    ]);
  });
});
