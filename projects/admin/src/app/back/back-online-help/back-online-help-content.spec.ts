import helpContentDocument from '../../../assets/documentation/back-online-help.json';
import { BACK_ROUTE_PATHS } from '../routes/back-route-paths';

type DocumentTopic = {
  id: string;
  scope?: 'application' | 'general';
  contentStatus?: 'published' | 'planned';
  manualChapterOrder?: number;
  routeKey?: string;
  nav: {
    menuTitle?: string;
    groupLevel: string;
    adminOnly?: boolean;
  };
  illustrations?: {
    id: string;
    path: string;
    alt: string;
    source?: string;
  }[];
  blocks: {
    id: string;
    type: string;
    illustrationId?: string;
  }[];
  children?: DocumentTopic[];
};

function flattenTopics(topics: DocumentTopic[]): DocumentTopic[] {
  return topics.flatMap((topic) => [
    topic,
    ...flattenTopics(topic.children ?? []),
  ]);
}

describe('back online help content', () => {
  const topics = flattenTopics(helpContentDocument.topics as DocumentTopic[]);

  it('uses unique topic and illustration identifiers', () => {
    const topicIds = topics.map((topic) => topic.id);
    const illustrationIds = topics.flatMap((topic) =>
      (topic.illustrations ?? []).map((illustration) => illustration.id));

    expect(new Set(topicIds).size).withContext('Duplicate help topic ID').toBe(topicIds.length);
    expect(new Set(illustrationIds).size)
      .withContext('Duplicate help illustration ID')
      .toBe(illustrationIds.length);
  });

  it('uses unique stable block identifiers within each topic', () => {
    for (const topic of topics) {
      const blockIds = topic.blocks.map((block) => block.id);
      expect(new Set(blockIds).size)
        .withContext(`Duplicate block ID for ${topic.id}`)
        .toBe(blockIds.length);
    }
  });

  it('uses supported block types and valid illustration references', () => {
    const supportedTypes = new Set([
      'text',
      'list',
      'procedure',
      'illustration',
      'table',
      'attention',
    ]);

    for (const topic of topics) {
      const illustrationIds = new Set(
        (topic.illustrations ?? []).map((illustration) => illustration.id),
      );
      for (const block of topic.blocks) {
        expect(supportedTypes.has(block.type))
          .withContext(`Unsupported block type ${block.type} for ${topic.id}/${block.id}`)
          .toBeTrue();
        if (block.type === 'illustration') {
          expect(illustrationIds.has(block.illustrationId ?? ''))
            .withContext(`Unknown illustration for ${topic.id}/${block.id}`)
            .toBeTrue();
        }
      }
    }
  });

  it('only references known route keys', () => {
    const routeKeys = new Set([...Object.keys(BACK_ROUTE_PATHS), 'FrontHome']);

    for (const topic of topics) {
      if (!topic.routeKey) continue;
      expect(routeKeys.has(topic.routeKey))
        .withContext(`Unknown route key ${topic.routeKey} for ${topic.id}`)
        .toBeTrue();
    }
  });

  it('defines Architecture as the first general manual chapter without an application route', () => {
    const architecture = helpContentDocument.topics[0] as DocumentTopic;

    expect(architecture.id).toBe('architecture');
    expect(architecture.scope).toBe('general');
    expect(architecture.contentStatus).toBe('planned');
    expect(architecture.manualChapterOrder).toBe(1);
    expect(architecture.routeKey).toBeUndefined();
    expect(architecture.nav.menuTitle).toBeUndefined();
    expect(architecture.children?.map((topic) => topic.id)).toEqual([
      'architecture-presentation-vocabulaire',
      'architecture-espaces',
      'architecture-acces-droits',
      'architecture-systeme',
    ]);
  });

  it('preserves the card administration topic identity and access metadata', () => {
    const topic = topics.find((candidate) => candidate.id === 'adherents-cartes');

    expect(topic).toBeDefined();
    expect(topic?.routeKey).toBe('GameCardsEditor');
    expect(topic?.nav.groupLevel).toBe('Administrateur');
    expect(topic?.nav.adminOnly).toBeTrue();
  });

  it('preserves the member controls topic identity and access metadata', () => {
    const topic = topics.find((candidate) => candidate.id === 'adherents-controles');

    expect(topic).toBeDefined();
    expect(topic?.routeKey).toBe('MemberSales');
    expect(topic?.nav.groupLevel).toBe('Contributeur');
  });

  it('preserves the directory topic identity, access metadata and reference source', () => {
    const topic = topics.find((candidate) => candidate.id === 'adherents-repertoire');

    expect(topic).toBeDefined();
    expect(topic?.routeKey).toBe('MembersDatabase');
    expect(topic?.nav.groupLevel).toBe('Contributeur');
    expect(topic?.illustrations?.[0]?.source)
      .toBe('docs/documentation/sources/BCSTO_manuel_reference.pptx');
  });

  it('defines complete absolute illustration paths', () => {
    for (const topic of topics) {
      for (const illustration of topic.illustrations ?? []) {
        expect(illustration.path.startsWith('/'))
          .withContext(`Relative illustration path ${illustration.path} for ${topic.id}`)
          .toBeTrue();
        expect(illustration.alt.trim())
          .withContext(`Missing illustration alternative for ${topic.id}`)
          .toBeTruthy();
      }
    }
  });

  it('serves every referenced illustration through the configured Angular assets', async () => {
    for (const topic of topics) {
      for (const illustration of topic.illustrations ?? []) {
        const response = await fetch(illustration.path);
        expect(response.ok)
          .withContext(`Missing illustration ${illustration.path} for ${topic.id}`)
          .toBeTrue();
        expect(response.headers.get('content-type')?.toLowerCase().startsWith('image/'))
          .withContext(`Non-image content type for ${illustration.path}`)
          .toBeTrue();
      }
    }
  });
});
