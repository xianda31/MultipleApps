import { from, Observable } from 'rxjs';
import { getCurrentUser } from 'aws-amplify/auth';

export async function safeGetCurrentUserPromise(): Promise<any | null> {
  try {
    const u = await getCurrentUser();
    return u ?? null;
  } catch (err) {
    return null;
  }
}

export function safeGetCurrentUser$(): Observable<any | null> {
  return from(safeGetCurrentUserPromise());
}
