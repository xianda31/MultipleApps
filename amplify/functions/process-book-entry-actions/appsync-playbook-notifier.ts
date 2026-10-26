import { Sha256 } from '@aws-crypto/sha256-js';
import { SignatureV4 } from '@smithy/signature-v4';

type GraphqlResponse = {
  data?: {
    updatePlayBook?: {
      id?: string;
    };
  };
  errors?: Array<{
    message?: string;
  }>;
};

export async function notifyPlayBookUpdate(playBookId: string): Promise<void> {
  const endpointValue = process.env['APPSYNC_GRAPHQL_URL'];
  const region = process.env['AWS_REGION'];
  const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
  const sessionToken = process.env['AWS_SESSION_TOKEN'];
  if (!endpointValue || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('AppSync notification environment is incomplete');
  }

  const endpoint = new URL(endpointValue);
  const body = JSON.stringify({
    query: [
      'mutation NotifyPlayBookUpdate($id: ID!) {',
      '  updatePlayBook(input: { id: $id, manual_creation: false }) {',
      '    id',
      '    initial_qty',
      '    licenses',
      '    stamps',
      '    comment',
      '    manual_creation',
      '    bookEntry_id',
      '    createdAt',
      '    updatedAt',
      '  }',
      '}',
    ].join('\n'),
    variables: { id: playBookId },
  });
  const signer = new SignatureV4({
    credentials: {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    },
    region,
    service: 'appsync',
    sha256: Sha256,
  });
  const signed = await signer.sign({
    method: 'POST',
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    path: endpoint.pathname,
    headers: {
      'content-type': 'application/json',
      host: endpoint.host,
    },
    body,
  });
  const response = await fetch(endpoint, {
    method: signed.method,
    headers: signed.headers,
    body,
  });
  const payload = await response.json() as GraphqlResponse;
  if (!response.ok || payload.errors?.length || payload.data?.updatePlayBook?.id !== playBookId) {
    const details = payload.errors?.map(error => error.message || 'Unknown GraphQL error').join(', ')
      || `HTTP ${response.status}`;
    throw new Error(`Unable to notify PlayBook update: ${details}`);
  }
}
