import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { AccreditationGuard } from './accreditation.guard';
import { Group_names, Group_priorities } from './common/authentification/group.interface';
import { GroupService } from './common/authentification/group.service';

describe('AccreditationGuard', () => {
  let groupService: jasmine.SpyObj<GroupService>;
  let router: jasmine.SpyObj<Router>;
  let guard: AccreditationGuard;
  const redirect = {} as UrlTree;

  beforeEach(() => {
    groupService = jasmine.createSpyObj<GroupService>('GroupService', ['getUserAccreditation']);
    router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue(redirect);
    guard = new AccreditationGuard(groupService, router);
  });

  it('denies a route without a configured minimum level', async () => {
    const route = { data: {}, routeConfig: { path: 'unconfigured' } } as unknown as ActivatedRouteSnapshot;

    await expectAsync(guard.canActivate(route)).toBeResolvedTo(redirect);
    expect(groupService.getUserAccreditation).not.toHaveBeenCalled();
  });

  it('allows a user whose accreditation reaches the minimum level', async () => {
    groupService.getUserAccreditation.and.resolveTo({ level: 3 } as any);
    const route = { data: { minimumAccreditationLevel: 3 } } as unknown as ActivatedRouteSnapshot;

    await expectAsync(guard.canActivate(route)).toBeResolvedTo(true);
  });

  it('redirects a user whose accreditation is too low', async () => {
    groupService.getUserAccreditation.and.resolveTo({ level: 1 } as any);
    const route = { data: { minimumAccreditationLevel: 3 } } as unknown as ActivatedRouteSnapshot;

    await expectAsync(guard.canActivate(route)).toBeResolvedTo(redirect);
  });

  it('allows an Editor route and rejects Admin and System routes for an Editor', async () => {
    groupService.getUserAccreditation.and.resolveTo({
      level: Group_priorities[Group_names.Editor],
    } as any);

    const editorRoute = {
      data: { minimumAccreditationLevel: Group_priorities[Group_names.Editor] },
    } as unknown as ActivatedRouteSnapshot;
    const adminRoute = {
      data: { minimumAccreditationLevel: Group_priorities[Group_names.Admin] },
    } as unknown as ActivatedRouteSnapshot;
    const systemRoute = {
      data: { minimumAccreditationLevel: Group_priorities[Group_names.System] },
    } as unknown as ActivatedRouteSnapshot;

    await expectAsync(guard.canActivate(editorRoute)).toBeResolvedTo(true);
    await expectAsync(guard.canActivate(adminRoute)).toBeResolvedTo(redirect);
    await expectAsync(guard.canActivate(systemRoute)).toBeResolvedTo(redirect);
  });
});