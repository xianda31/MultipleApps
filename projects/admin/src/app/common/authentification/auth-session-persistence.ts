const AUTH_SESSION_POLICY_KEY = 'auth_session_policy';
const DAY_MS = 24 * 60 * 60 * 1000;

export const STANDARD_AUTH_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
export const DEFAULT_REMEMBERED_AUTH_SESSION_DAYS = 30;
export const MAX_REMEMBERED_AUTH_SESSION_DAYS = 30;
export const REMEMBERED_AUTH_SESSION_DURATION_MS = DEFAULT_REMEMBERED_AUTH_SESSION_DAYS * DAY_MS;

interface AuthSessionPolicy {
  expiresAt: number;
  remembered: boolean;
}

export function normalizeRememberedSessionDays(value: unknown): number {
  const days = Number(value);
  if (!Number.isFinite(days)) {
    return DEFAULT_REMEMBERED_AUTH_SESSION_DAYS;
  }
  return Math.min(MAX_REMEMBERED_AUTH_SESSION_DAYS, Math.max(1, Math.trunc(days)));
}

export function persistAuthSessionPolicy(
  remembered: boolean,
  rememberedSessionDays = DEFAULT_REMEMBERED_AUTH_SESSION_DAYS,
  now = Date.now(),
): void {
  const duration = remembered
    ? normalizeRememberedSessionDays(rememberedSessionDays) * DAY_MS
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
