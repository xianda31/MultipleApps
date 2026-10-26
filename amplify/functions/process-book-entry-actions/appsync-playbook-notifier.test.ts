import assert from 'node:assert/strict';
import test from 'node:test';
import { notifyPlayBookUpdate } from './appsync-playbook-notifier';

test('publishes a signed AppSync update for the created PlayBook', async () => {
  const previousEnvironment = {
    endpoint: process.env['APPSYNC_GRAPHQL_URL'],
    region: process.env['AWS_REGION'],
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
    sessionToken: process.env['AWS_SESSION_TOKEN'],
  };
  process.env['APPSYNC_GRAPHQL_URL'] = 'https://example.appsync-api.eu-west-3.amazonaws.com/graphql';
  process.env['AWS_REGION'] = 'eu-west-3';
  process.env['AWS_ACCESS_KEY_ID'] = 'test-access-key';
  process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret-key';
  process.env['AWS_SESSION_TOKEN'] = 'test-session-token';

  const originalFetch = globalThis.fetch;
  let capturedBody = '';
  let capturedAuthorization = '';
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    capturedBody = String(init?.body || '');
    capturedAuthorization = new Headers(init?.headers).get('authorization') || '';
    return new Response(JSON.stringify({
      data: {
        updatePlayBook: {
          id: 'playbook-1',
        },
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    await notifyPlayBookUpdate('playbook-1');

    assert.match(capturedAuthorization, /^AWS4-HMAC-SHA256 /);
    assert.match(capturedBody, /NotifyPlayBookUpdate/);
    assert.match(capturedBody, /playbook-1/);
    assert.match(capturedBody, /initial_qty/);
    assert.match(capturedBody, /licenses/);
    assert.match(capturedBody, /stamps/);
    assert.match(capturedBody, /updatedAt/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment('APPSYNC_GRAPHQL_URL', previousEnvironment.endpoint);
    restoreEnvironment('AWS_REGION', previousEnvironment.region);
    restoreEnvironment('AWS_ACCESS_KEY_ID', previousEnvironment.accessKeyId);
    restoreEnvironment('AWS_SECRET_ACCESS_KEY', previousEnvironment.secretAccessKey);
    restoreEnvironment('AWS_SESSION_TOKEN', previousEnvironment.sessionToken);
  }
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
