import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { GroupService } from './common/authentification/group.service';

@Injectable({ providedIn: 'root' })
export class AccreditationGuard implements CanActivate {
  constructor(
    private groupService: GroupService,
    private router: Router,
  ) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean | UrlTree> {
    const minimumLevel = route.data['minimumAccreditationLevel'];

    try {
      const accreditation = await this.groupService.getUserAccreditation();
      return accreditation.level >= minimumLevel
        ? true
        : this.router.createUrlTree(['/back/home']);
    } catch {
      return this.router.createUrlTree(['/front']);
    }
  }
}