import helpContentDocument from '../../../assets/documentation/back-online-help.json';
import { BACK_ROUTE_PATHS } from '../routes/back-route-paths';

type DocumentTopic = {
  id: string;
  routeKey?: string;
  nav: {
    groupLevel: string;
    adminOnly?: boolean;
  };
  illustrations?: {
    id: string;
    path: string;
    alt: string;
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

  it('only references known route keys', () => {
    const routeKeys = new Set([...Object.keys(BACK_ROUTE_PATHS), 'FrontHome']);

    for (const topic of topics) {
      if (!topic.routeKey) continue;
      expect(routeKeys.has(topic.routeKey))
        .withContext(`Unknown route key ${topic.routeKey} for ${topic.id}`)
        .toBeTrue();
    }
  });

  it('preserves the card administration topic identity and access metadata', () => {
    const topic = topics.find((candidate) => candidate.id === 'adherents-cartes');

    expect(topic).toBeDefined();
    expect(topic?.routeKey).toBe('GameCardsEditor');
    expect(topic?.nav.groupLevel).toBe('Administrateur');
    expect(topic?.nav.adminOnly).toBeTrue();
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
      }
    }
  });
});
