import {
  clearAuthSessionPolicy,
  DEFAULT_REMEMBERED_AUTH_SESSION_DAYS,
  hasValidPersistedAuthSession,
  MAX_REMEMBERED_AUTH_SESSION_DAYS,
  normalizeRememberedSessionDays,
  persistAuthSessionPolicy,
  REMEMBERED_AUTH_SESSION_DURATION_MS,
  STANDARD_AUTH_SESSION_DURATION_MS,
} from './auth-session-persistence';

describe('auth session persistence', () => {
  const now = 1_000_000;

  afterEach(() => clearAuthSessionPolicy());

  it('keeps a standard session restorable for eight hours', () => {
    persistAuthSessionPolicy(false, DEFAULT_REMEMBERED_AUTH_SESSION_DAYS, now);

    expect(hasValidPersistedAuthSession(now + STANDARD_AUTH_SESSION_DURATION_MS - 1)).toBeTrue();
    expect(hasValidPersistedAuthSession(now + STANDARD_AUTH_SESSION_DURATION_MS)).toBeFalse();
  });

  it('keeps a remembered session restorable for thirty days by default', () => {
    persistAuthSessionPolicy(true, DEFAULT_REMEMBERED_AUTH_SESSION_DAYS, now);

    expect(hasValidPersistedAuthSession(now + REMEMBERED_AUTH_SESSION_DURATION_MS - 1)).toBeTrue();
    expect(hasValidPersistedAuthSession(now + REMEMBERED_AUTH_SESSION_DURATION_MS)).toBeFalse();
  });

  it('uses a configured duration and caps it at the Cognito limit', () => {
    persistAuthSessionPolicy(true, 15, now);
    expect(hasValidPersistedAuthSession(now + 15 * 24 * 60 * 60 * 1000 - 1)).toBeTrue();
    expect(hasValidPersistedAuthSession(now + 15 * 24 * 60 * 60 * 1000)).toBeFalse();

    expect(normalizeRememberedSessionDays(60)).toBe(MAX_REMEMBERED_AUTH_SESSION_DAYS);
    expect(normalizeRememberedSessionDays(0)).toBe(1);
  });

  it('rejects missing or invalid session policies', () => {
    expect(hasValidPersistedAuthSession(now)).toBeFalse();

    localStorage.setItem('auth_session_policy', 'invalid');
    expect(hasValidPersistedAuthSession(now)).toBeFalse();
  });
});
