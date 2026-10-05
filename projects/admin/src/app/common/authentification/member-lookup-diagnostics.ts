export interface SanitizedGraphqlError {
  message: string;
  errorType?: string;
  path?: string;
}

export function sanitizeGraphqlErrors(error: unknown): SanitizedGraphqlError[] {
  const entries = Array.isArray(error) ? error : [error];
  return entries.filter(Boolean).map((entry: any) => ({
    message: String(entry?.message || 'unknown error').slice(0, 300),
    errorType: String(entry?.errorType || entry?.extensions?.errorType || '').slice(0, 100) || undefined,
    path: Array.isArray(entry?.path) ? entry.path.map(String).join('.') : undefined,
  }));
}

export function classifyMemberLookupError(error: unknown): string {
  const entries = sanitizeGraphqlErrors(error);
  const searchable = entries
    .map(entry => `${entry.errorType || ''} ${entry.message}`.toLowerCase())
    .join(' ');

  if (searchable.includes('unauthorized') || searchable.includes('not authorized')) return 'graphql-unauthorized';
  if (searchable.includes('network') || searchable.includes('fetch') || searchable.includes('timeout')) return 'network';
  if (searchable.includes('validation') || searchable.includes('unknown field')) return 'graphql-schema';
  return 'graphql-or-api';
}

export function normalizeUniqueEmails(emails: Array<string | undefined>): string[] {
  return [...new Set(emails.map(email => (email || '').trim().toLowerCase()).filter(Boolean))];
}