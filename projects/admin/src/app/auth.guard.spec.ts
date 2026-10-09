import { Router, UrlTree } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthGuard } from './auth.guard';
import { AuthentificationService } from './common/authentification/authentification.service';
import { Member } from './common/interfaces/member.interface';

describe('AuthGuard', () => {
  let isRestoringSession$: BehaviorSubject<boolean>;
  let router: jasmine.SpyObj<Router>;
  const redirect = {} as UrlTree;

  beforeEach(() => {
    isRestoringSession$ = new BehaviorSubject<boolean>(true);
    router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue(redirect);
  });

  function createGuard(currentMember: Member | null): AuthGuard {
    const auth = jasmine.createSpyObj<AuthentificationService>(
      'AuthentificationService',
      [],
      { isRestoringSession$, currentMember },
    );
    return new AuthGuard(auth, router);
  }

  it('waits for session restoration and allows an authenticated member', async () => {
    const guard = createGuard({ id: 'member-1' } as Member);
    const result = guard.canActivate();

    expect(router.createUrlTree).not.toHaveBeenCalled();
    isRestoringSession$.next(false);

    await expectAsync(result).toBeResolvedTo(true);
  });

  it('redirects as soon as session restoration confirms there is no member', async () => {
    const guard = createGuard(null);
    const result = guard.canActivate();

    isRestoringSession$.next(false);

    await expectAsync(result).toBeResolvedTo(redirect);
    expect(router.createUrlTree).toHaveBeenCalledOnceWith(['/front']);
  });
});
