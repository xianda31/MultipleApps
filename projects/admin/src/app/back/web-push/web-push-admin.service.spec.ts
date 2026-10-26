import { parseWebPushSendResult } from './web-push-admin.service';

describe('WebPushAdminService result parsing', () => {
  const result = {
    selected: 3,
    sent: 2,
    expired: 1,
    failed: 0,
    failures: [],
  };

  it('accepts an Amplify JSON object', () => {
    expect(parseWebPushSendResult(result)).toEqual(result);
  });

  it('accepts a serialized Amplify JSON result', () => {
    expect(parseWebPushSendResult(JSON.stringify(result))).toEqual(result);
  });

  it('rejects an incomplete server result', () => {
    expect(() => parseWebPushSendResult({ sent: 1 }))
      .toThrowError('Le serveur Web Push a retourné un bilan incomplet.');
  });
});
