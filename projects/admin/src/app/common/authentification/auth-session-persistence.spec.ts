import {
  clearAuthSessionPolicy,
  hasValidPersistedAuthSession,
  persistAuthSessionPolicy,
  REMEMBERED_AUTH_SESSION_DURATION_MS,
  STANDARD_AUTH_SESSION_DURATION_MS,
} from './auth-session-persistence';

describe('auth session persistence', () => {
  const now = 1_000_000;

  afterEach(() => clearAuthSessionPolicy());

  it('keeps a standard session restorable for eight hours', () => {
    persistAuthSessionPolicy(false, now);

    expect(hasValidPersistedAuthSession(now + STANDARD_AUTH_SESSION_DURATION_MS - 1)).toBeTrue();
    expect(hasValidPersistedAuthSession(now + STANDARD_AUTH_SESSION_DURATION_MS)).toBeFalse();
  });

  it('keeps a remembered session restorable for seven days', () => {
    persistAuthSessionPolicy(true, now);

    expect(hasValidPersistedAuthSession(now + REMEMBERED_AUTH_SESSION_DURATION_MS - 1)).toBeTrue();
    expect(hasValidPersistedAuthSession(now + REMEMBERED_AUTH_SESSION_DURATION_MS)).toBeFalse();
  });

  it('rejects missing or invalid session policies', () => {
    expect(hasValidPersistedAuthSession(now)).toBeFalse();

    localStorage.setItem('auth_session_policy', 'invalid');
    expect(hasValidPersistedAuthSession(now)).toBeFalse();
  });
});
