import { Injectable } from '@angular/core';
import { DBhandler } from './graphQL.service';
import { Observable, from, map, switchMap } from 'rxjs';
import { Group_names } from '../authentification/group.interface';

export interface PageViewStats {
  todayAuthenticated: number;
  todayMembers: number;
  todayStaff: number;
  todayAnonymous: number;
  byMonth: {
    yearMonth: string;
    total: number;
    authenticated: number;
    members: number;
    staff: number;
    anonymous: number;
  }[];
}

interface LocalVisitSession {
  sessionId: string;
  lastSeenAt: string;
}

@Injectable({ providedIn: 'root' })
export class PageViewService {

  private readonly SESSION_KEY = 'bcso.visit.session';
  private readonly SESSION_TIMEOUT_MINUTES = 30;
  private trackingQueue: Promise<void> = Promise.resolve();

  constructor(private db: DBhandler) {}

  trackVisit(url: string, authenticated = false, groupName?: Group_names | Promise<Group_names | undefined>): Promise<void> {
    const tracking = this.trackingQueue.then(async () =>
      this.trackVisitInternal(url, authenticated, await Promise.resolve(groupName))
    );
    this.trackingQueue = tracking.catch(() => undefined);
    return tracking;
  }

  private async trackVisitInternal(url: string, authenticated: boolean, groupName?: Group_names): Promise<void> {
    const cleanUrl = this.normalizeUrl(url);

    if (!this.shouldTrackUrl(cleanUrl)) {
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const date = nowIso.slice(0, 10);
    const yearMonth = nowIso.slice(0, 7);
    const ttl = this.getSessionTtl(now);
    const section = cleanUrl.startsWith('/back') ? 'back' : 'front';
    const isAuthenticated = authenticated;

    const local = this.getLocalSession();
    const isExpired = local ? this.isExpired(local.lastSeenAt, nowIso) : true;
    let isNewSession = !local || isExpired;

    let sessionId = local?.sessionId;
    let transitionedToAuthenticated = false;
    let statDate = date;
    let statYearMonth = yearMonth;
    let statSection = section;

    try {
      if (isNewSession) {
        sessionId = this.generateSessionId();
        await this.db.createVisitSession({
          sessionId,
          date,
          yearMonth,
          firstSeenAt: nowIso,
          lastSeenAt: nowIso,
          pageViewCount: 1,
          authenticated: isAuthenticated,
          groupName,
          section,
          ttl,
        });
      } else {
        const currentSession = await this.db.readVisitSession(sessionId!);
        if (!currentSession) {
          isNewSession = true;
          sessionId = this.generateSessionId();
          await this.db.createVisitSession({
            sessionId,
            date,
            yearMonth,
            firstSeenAt: nowIso,
            lastSeenAt: nowIso,
            pageViewCount: 1,
            authenticated: isAuthenticated,
            groupName,
            section,
            ttl,
          });
        } else {
          transitionedToAuthenticated = !currentSession.authenticated && isAuthenticated;
          statDate = currentSession.date;
          statYearMonth = currentSession.yearMonth;
          statSection = currentSession.section;
          await this.db.updateVisitSession({
            sessionId: currentSession.sessionId,
            lastSeenAt: nowIso,
            // Keep session alive without tracking page-by-page navigation.
            pageViewCount: currentSession.pageViewCount || 1,
            authenticated: currentSession.authenticated || isAuthenticated,
            groupName: currentSession.groupName || groupName,
            section: currentSession.section,
            ttl: this.getSessionTtl(new Date(currentSession.firstSeenAt)),
          });
        }
      }

      if (isNewSession || transitionedToAuthenticated) {
        await this.upsertDailyStat({
          date: statDate,
          yearMonth: statYearMonth,
          section: statSection,
          isNewSession,
          isAuthenticated,
          transitionedToAuthenticated,
        });
      }

      this.saveLocalSession({ sessionId: sessionId!, lastSeenAt: nowIso });
    } catch (err) {
      // non bloquant
      console.warn('[PageViewService] trackVisit failed:', err);
    }
  }

  getStats(monthWindow: string[], includeSystemVisits = false): Observable<PageViewStats> {
    const today = new Date().toISOString().slice(0, 10);
    return from(this.trackingQueue).pipe(
      switchMap(() => this.db.listVisitSessions()),
      map(sessions => {
        const scopedSessions = sessions.filter(session =>
          monthWindow.includes(session.yearMonth)
          && (includeSystemVisits || session.groupName !== Group_names.System)
        );
        const todaySessions = scopedSessions.filter(session => session.date === today);

        const byMonth = monthWindow.map(ym => {
          const monthSessions = scopedSessions.filter(session => session.yearMonth === ym);
          const authenticatedSessions = monthSessions.filter(session => session.authenticated);
          return {
            yearMonth: ym,
            total: monthSessions.length,
            authenticated: authenticatedSessions.length,
            members: authenticatedSessions.filter(session => this.isMemberSession(session.groupName)).length,
            staff: authenticatedSessions.filter(session => !this.isMemberSession(session.groupName)).length,
            anonymous: monthSessions.filter(session => !session.authenticated).length,
          };
        });

        const todayAuthenticatedSessions = todaySessions.filter(session => session.authenticated);

        return {
          todayAuthenticated: todayAuthenticatedSessions.length,
          todayMembers: todayAuthenticatedSessions.filter(session => this.isMemberSession(session.groupName)).length,
          todayStaff: todayAuthenticatedSessions.filter(session => !this.isMemberSession(session.groupName)).length,
          todayAnonymous: todaySessions.filter(session => !session.authenticated).length,
          byMonth,
        };
      })
    );
  }

  private isMemberSession(groupName?: string | null): boolean {
    return !groupName || groupName === Group_names.Member;
  }

  private getSessionTtl(firstSeenAt: Date): number {
    const expiresAt = new Date(firstSeenAt);
    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 13);
    return Math.floor(expiresAt.getTime() / 1000);
  }

  private async upsertDailyStat(params: {
    date: string;
    yearMonth: string;
    section: string;
    isNewSession: boolean;
    isAuthenticated: boolean;
    transitionedToAuthenticated: boolean;
  }): Promise<void> {
    const existing = await this.db.readVisitDailyStat(params.date, params.section);

    const base = existing || {
      date: params.date,
      section: params.section,
      yearMonth: params.yearMonth,
      totalSessions: 0,
      authenticatedSessions: 0,
      anonymousSessions: 0,
      pageViews: 0,
    };

    const next = {
      date: base.date,
      section: base.section,
      yearMonth: base.yearMonth,
      totalSessions: base.totalSessions,
      authenticatedSessions: base.authenticatedSessions,
      anonymousSessions: base.anonymousSessions,
      // Page views are no longer tracked as a metric.
      pageViews: base.pageViews || 0,
    };

    if (params.isNewSession) {
      next.totalSessions += 1;
      if (params.isAuthenticated) {
        next.authenticatedSessions += 1;
      } else {
        next.anonymousSessions += 1;
      }
    } else if (params.transitionedToAuthenticated) {
      next.authenticatedSessions += 1;
      next.anonymousSessions = Math.max(next.anonymousSessions - 1, 0);
    }

    if (!existing) {
      await this.db.createVisitDailyStat(next);
    } else {
      await this.db.updateVisitDailyStat({
        date: next.date,
        section: next.section,
        totalSessions: next.totalSessions,
        authenticatedSessions: next.authenticatedSessions,
        anonymousSessions: next.anonymousSessions,
        pageViews: next.pageViews,
      });
    }
  }

  private getLocalSession(): LocalVisitSession | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(this.SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LocalVisitSession;
    } catch {
      return null;
    }
  }

  private saveLocalSession(session: LocalVisitSession): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  }

  private isExpired(lastSeenAt: string, nowIso: string): boolean {
    const last = new Date(lastSeenAt).getTime();
    const now = new Date(nowIso).getTime();
    if (Number.isNaN(last) || Number.isNaN(now)) return true;
    const maxMs = this.SESSION_TIMEOUT_MINUTES * 60 * 1000;
    return now - last > maxMs;
  }

  private generateSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private normalizeUrl(url: string): string {
    const noHash = url.split('#', 1)[0] || '';
    const noQuery = noHash.split('?', 1)[0] || '';
    return noQuery || '/';
  }

  private shouldTrackUrl(url: string): boolean {
    // Skip technical routes that create noisy anonymous sessions.
    if (url === '/' || url === '/front/authentication') {
      return false;
    }
    return url.startsWith('/back') || url.startsWith('/front');
  }
}
