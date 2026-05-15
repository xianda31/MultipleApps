import { Injectable } from '@angular/core';
import { DBhandler } from './graphQL.service';
import { Observable, map } from 'rxjs';

export interface PageViewStats {
  todayAuthenticated: number;
  todayAnonymous: number;
  byMonth: { yearMonth: string; total: number; authenticated: number; anonymous: number }[];
}

interface LocalVisitSession {
  sessionId: string;
  lastSeenAt: string;
}

@Injectable({ providedIn: 'root' })
export class PageViewService {

  private readonly SESSION_KEY = 'bcso.visit.session';
  private readonly SESSION_TIMEOUT_MINUTES = 30;

  constructor(private db: DBhandler) {}

  async trackVisit(url: string, userId?: string): Promise<void> {
    const cleanUrl = this.normalizeUrl(url);

    if (!this.shouldTrackUrl(cleanUrl)) {
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const date = nowIso.slice(0, 10);
    const yearMonth = nowIso.slice(0, 7);
    const section = cleanUrl.startsWith('/back') ? 'back' : 'front';
    const isAuthenticated = !!userId;

    const local = this.getLocalSession();
    const isExpired = local ? this.isExpired(local.lastSeenAt, nowIso) : true;
    const isNewSession = !local || isExpired;

    let sessionId = local?.sessionId;
    let transitionedToAuthenticated = false;

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
          memberId: userId,
          section,
        });
      } else {
        const currentSession = await this.db.readVisitSession(sessionId!);
        if (!currentSession) {
          sessionId = this.generateSessionId();
          await this.db.createVisitSession({
            sessionId,
            date,
            yearMonth,
            firstSeenAt: nowIso,
            lastSeenAt: nowIso,
            pageViewCount: 1,
            authenticated: isAuthenticated,
            memberId: userId,
            section,
          });
        } else {
          transitionedToAuthenticated = !currentSession.authenticated && isAuthenticated;
          await this.db.updateVisitSession({
            sessionId: currentSession.sessionId,
            lastSeenAt: nowIso,
            // Keep session alive without tracking page-by-page navigation.
            pageViewCount: currentSession.pageViewCount || 1,
            authenticated: currentSession.authenticated || isAuthenticated,
            memberId: currentSession.memberId || userId,
            section,
          });
        }
      }

      await this.upsertDailyStat({
        date,
        yearMonth,
        section,
        isNewSession,
        isAuthenticated,
        transitionedToAuthenticated,
      });

      this.saveLocalSession({ sessionId: sessionId!, lastSeenAt: nowIso });
    } catch (err) {
      // non bloquant
      console.warn('[PageViewService] trackVisit failed:', err);
    }
  }

  getStats(monthWindow: string[]): Observable<PageViewStats> {
    const today = new Date().toISOString().slice(0, 10);
    return this.db.listVisitDailyStats().pipe(
      map(stats => {
        const scopedStats = stats.filter(v => monthWindow.includes(v.yearMonth));
        const todayStats = scopedStats.filter(v => v.date === today);

        const byMonth = monthWindow.map(ym => {
          const monthStats = scopedStats.filter(v => v.yearMonth === ym);
          return {
            yearMonth: ym,
            total: monthStats.reduce((acc, row) => acc + (row.totalSessions || 0), 0),
            authenticated: monthStats.reduce((acc, row) => acc + (row.authenticatedSessions || 0), 0),
            anonymous: monthStats.reduce((acc, row) => acc + (row.anonymousSessions || 0), 0),
          };
        });

        return {
          todayAuthenticated: todayStats.reduce((acc, row) => acc + (row.authenticatedSessions || 0), 0),
          todayAnonymous: todayStats.reduce((acc, row) => acc + (row.anonymousSessions || 0), 0),
          byMonth,
        };
      })
    );
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
