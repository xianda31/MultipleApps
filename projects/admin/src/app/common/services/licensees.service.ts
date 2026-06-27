import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { ClubMember } from '../ffb/interface/club-member.interface';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { FFBPersonIV } from '../interfaces/FFBperson.interface';

@Injectable({
  providedIn: 'root'
})
export class LicenseesService {
  private clubMembers$: Observable<ClubMember[]> | null = null;

  constructor(
    private FFBService: FFB_proxyService
  ) { }

  /**
   * Get all club members (adherents) from FFB API
   * Cached with shareReplay(1) to prevent duplicate API calls
   */
  getClubMembers$(): Observable<ClubMember[]> {
    if (!this.clubMembers$) {
      this.clubMembers$ = from(this.FFBService.getAdherents()).pipe(
        shareReplay(1)
      );
    }
    return this.clubMembers$;
  }

 
}
