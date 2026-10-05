import {
  classifyMemberLookupError,
  normalizeUniqueEmails,
  sanitizeGraphqlErrors,
} from './member-lookup-diagnostics';

describe('member lookup diagnostics', () => {
  it('deduplicates normalized lookup emails', () => {
    expect(normalizeUniqueEmails([' Test@Example.fr ', 'test@example.fr', undefined]))
      .toEqual(['test@example.fr']);
  });

  it('classifies and sanitizes unauthorized GraphQL errors', () => {
    const errors = [{
      message: 'Not Authorized to access listMembers on type Query',
      errorType: 'Unauthorized',
      path: ['listMembers'],
    }];

    expect(classifyMemberLookupError(errors)).toBe('graphql-unauthorized');
    expect(sanitizeGraphqlErrors(errors)).toEqual([{
      message: 'Not Authorized to access listMembers on type Query',
      errorType: 'Unauthorized',
      path: 'listMembers',
    }]);
  });
});