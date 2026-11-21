import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Context } from 'aws-lambda';
import { handler, s3Client } from './handler';

describe('FFB club sessions', () => {
  it('uses the configured club and resolves the group again when the current season changes', async (t) => {
    const previousBucket = process.env.STORAGE_BUCKET_NAME;
    process.env.STORAGE_BUCKET_NAME = 'test-bucket';
    t.after(() => {
      if (previousBucket === undefined) delete process.env.STORAGE_BUCKET_NAME;
      else process.env.STORAGE_BUCKET_NAME = previousBucket;
    });

    t.mock.method(s3Client, 'send', async () => ({
      $metadata: {},
      Body: { transformToString: async () => JSON.stringify({ ffb_club_code: '5500055', ffb_organization_id: '1438' }) },
    }));

    let season = 38;
    const requests: URL[] = [];
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(url);
      if (url.pathname.endsWith('/seasons/current')) return Response.json({ id: season });
      if (url.pathname.endsWith('/results/search/')) return Response.json({
        items: [{
          organization: { id: 1438, ffbCode: '5500055' },
          phases: [{ groups: [{ id: season === 38 ? 12345 : 67890, label: 'A' }] }],
        }],
        pagination: { has_next_page: false },
      });
      return Response.json({ items: [], pagination: { total_pages: 1 } });
    });

    const event = {
      pathParameters: { proxy: 'ffb_v2/club-sessions' },
      queryStringParameters: { dateFrom: '2026-08-01', dateTo: '2026-09-30', currentPage: '2', maxPerPage: '40' },
      headers: { 'x-ffb-token': 'test-token' },
      requestContext: { http: { method: 'GET' } },
    };
    const first = await handler(event, {} as Context, () => {});
    season = 39;
    const second = await handler(event, {} as Context, () => {});

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    const resultsRequests = requests.filter((url) => url.pathname.endsWith('/results/search/'));
    assert.deepEqual(resultsRequests.map((url) => url.searchParams.get('season')), ['38', '39']);
    assert.ok(resultsRequests.every((url) => url.searchParams.get('organizationId') === '1438'));
    const sessionsRequests = requests.filter((url) => url.pathname.endsWith('/competitions/groupSessions/search'));
    assert.deepEqual(sessionsRequests.map((url) => url.searchParams.get('groupId')), ['12345', '67890']);
    assert.equal(sessionsRequests[0].searchParams.get('dateFrom'), '2026-08-01');
    assert.equal(sessionsRequests[0].searchParams.get('dateTo'), '2026-09-30');
    assert.equal(sessionsRequests[0].searchParams.get('currentPage'), '2');
    assert.equal(sessionsRequests[0].searchParams.get('maxPerPage'), '40');
  });

  it('rejects ambiguous groups without querying sessions or falling back to an old group', async (t) => {
    const previousBucket = process.env.STORAGE_BUCKET_NAME;
    process.env.STORAGE_BUCKET_NAME = 'test-bucket';
    t.after(() => {
      if (previousBucket === undefined) delete process.env.STORAGE_BUCKET_NAME;
      else process.env.STORAGE_BUCKET_NAME = previousBucket;
    });
    t.mock.method(s3Client, 'send', async () => ({
      $metadata: {},
      Body: { transformToString: async () => JSON.stringify({ ffb_club_code: '5500020', ffb_organization_id: '1403' }) },
    }));
    const requests: URL[] = [];
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(url);
      if (url.pathname.endsWith('/seasons/current')) return Response.json({ id: 38 });
      return Response.json({
        items: [{
          organization: { id: 1403, ffbCode: '5500020' },
          phases: [{ groups: [{ id: 1, label: 'A' }, { id: 2, label: 'A' }] }],
        }],
        pagination: { has_next_page: false },
      });
    });

    const response = await handler({
      pathParameters: { proxy: 'ffb_v2/club-sessions' },
      headers: { 'x-ffb-token': 'test-token' },
      requestContext: { http: { method: 'GET' } },
    }, {} as Context, () => {});

    assert.equal(response.statusCode, 500);
    assert.match(JSON.parse(response.body).details, /groupe FFB de régularité unique/);
    assert.equal(requests.length, 2);
  });

  it('preserves an upstream maintenance status while resolving the current season', async (t) => {
    const previousBucket = process.env.STORAGE_BUCKET_NAME;
    process.env.STORAGE_BUCKET_NAME = 'test-bucket';
    t.after(() => {
      if (previousBucket === undefined) delete process.env.STORAGE_BUCKET_NAME;
      else process.env.STORAGE_BUCKET_NAME = previousBucket;
    });
    t.mock.method(s3Client, 'send', async () => ({
      $metadata: {},
      Body: { transformToString: async () => JSON.stringify({ ffb_club_code: '5500020', ffb_organization_id: '1403' }) },
    }));
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'maintenance' }, { status: 503 }));

    const response = await handler({
      pathParameters: { proxy: 'ffb_v2/club-sessions' },
      headers: { 'x-ffb-token': 'test-token' },
      requestContext: { http: { method: 'GET' } },
    }, {} as Context, () => {});

    assert.equal(response.statusCode, 503);
  });
});

describe('FFB club search', () => {
  it('forwards a paginated club-name search to the public organizations endpoint', async (t) => {
    let requestedUrl: URL | undefined;
    let requestOptions: RequestInit | undefined;
    t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, options?: RequestInit) => {
      requestedUrl = new URL(String(input));
      requestOptions = options;
      return Response.json({
        items: [{ id: 1403, ffbCode: '5500020', label: 'Bridge Club de Saint Orens', type: 'club' }],
        pagination: { has_next_page: true },
      });
    });

    const response = await handler({
      pathParameters: { proxy: 'ffb_v2/clubs/search' },
      queryStringParameters: { label: ' Saint & Orens ', currentPage: '2' },
      requestContext: { http: { method: 'GET' } },
    }, {} as Context, () => {});

    assert.equal(response.statusCode, 200);
    assert.equal(requestedUrl?.pathname, '/organizations/entities/search');
    assert.equal(requestedUrl?.searchParams.get('label'), 'Saint & Orens');
    assert.equal(requestedUrl?.searchParams.get('type[]'), 'club');
    assert.equal(requestedUrl?.searchParams.get('currentPage'), '2');
    assert.equal(requestedUrl?.searchParams.get('maxPerPage'), '20');
    assert.equal(new Headers(requestOptions?.headers).has('X-Lancelot-Authorization'), false);
  });

  it('rejects invalid search inputs without calling the FFB', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
    for (const query of [
      { label: 'x', currentPage: '1' },
      { label: 'Club', currentPage: '0' },
      { label: 'Club', currentPage: '1&bad=1' },
    ]) {
      const response = await handler({
        pathParameters: { proxy: 'ffb_v2/clubs/search' },
        queryStringParameters: query,
        requestContext: { http: { method: 'GET' } },
      }, {} as Context, () => {});
      assert.equal(response.statusCode, 400);
    }
    assert.equal(fetchMock.mock.callCount(), 0);
  });
});
