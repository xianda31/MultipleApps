const AUTH_SESSION_POLICY_KEY = 'auth_session_policy';

export const STANDARD_AUTH_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
export const REMEMBERED_AUTH_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

interface AuthSessionPolicy {
  expiresAt: number;
  remembered: boolean;
}

export function persistAuthSessionPolicy(remembered: boolean, now = Date.now()): void {
  const duration = remembered
    ? REMEMBERED_AUTH_SESSION_DURATION_MS
    : STANDARD_AUTH_SESSION_DURATION_MS;
  const policy: AuthSessionPolicy = {
    expiresAt: now + duration,
    remembered,
  };
  localStorage.setItem(AUTH_SESSION_POLICY_KEY, JSON.stringify(policy));
}

export function hasValidPersistedAuthSession(now = Date.now()): boolean {
  const rawPolicy = localStorage.getItem(AUTH_SESSION_POLICY_KEY);
  if (!rawPolicy) {
    return false;
  }

  try {
    const policy = JSON.parse(rawPolicy) as Partial<AuthSessionPolicy>;
    return typeof policy.expiresAt === 'number' && policy.expiresAt > now;
  } catch {
    return false;
  }
}

export function clearAuthSessionPolicy(): void {
  localStorage.removeItem(AUTH_SESSION_POLICY_KEY);
}
