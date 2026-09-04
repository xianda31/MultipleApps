import { PageViewService } from './page-view.service';
import { firstValueFrom, of } from 'rxjs';
import { Group_names } from '../authentification/group.interface';

describe('PageViewService', () => {
  const sessionKey = 'bcso.visit.session';

  beforeEach(() => localStorage.removeItem(sessionKey));

  it('reclassifies an anonymous session in its original section', async () => {
    const now = new Date().toISOString();
    const date = now.slice(0, 10);
    const yearMonth = now.slice(0, 7);
    localStorage.setItem(sessionKey, JSON.stringify({ sessionId: 'session-1', lastSeenAt: now }));
    const db = jasmine.createSpyObj('DBhandler', [
      'readVisitSession', 'updateVisitSession', 'readVisitDailyStat', 'updateVisitDailyStat',
      'createVisitSession', 'createVisitDailyStat',
    ]);
    db.readVisitSession.and.resolveTo({
      sessionId: 'session-1', date, yearMonth, firstSeenAt: now, lastSeenAt: now,
      pageViewCount: 1, authenticated: false, section: 'front',
    });
    db.updateVisitSession.and.resolveTo();
    db.readVisitDailyStat.and.resolveTo({
      date, yearMonth, section: 'front', totalSessions: 1,
      authenticatedSessions: 0, anonymousSessions: 1, pageViews: 0,
    });
    db.updateVisitDailyStat.and.resolveTo();
    const service = new PageViewService(db);

    await service.trackVisit('/back/dashboard', true, Group_names.Admin);

    expect(db.updateVisitSession).toHaveBeenCalledWith(jasmine.objectContaining({
      sessionId: 'session-1', authenticated: true, groupName: Group_names.Admin, section: 'front',
    }));
    expect(db.updateVisitSession.calls.mostRecent().args[0].memberId).toBeUndefined();
    expect(db.updateVisitSession.calls.mostRecent().args[0].ttl).toEqual(jasmine.any(Number));
    expect(db.updateVisitDailyStat).toHaveBeenCalledWith(jasmine.objectContaining({
      date, section: 'front', totalSessions: 1,
      authenticatedSessions: 1, anonymousSessions: 0,
    }));
  });

  it('serializes rapid navigations into one visit session', async () => {
    let storedSession: any = null;
    let dailyStat: any = null;
    const db = jasmine.createSpyObj('DBhandler', [
      'readVisitSession', 'updateVisitSession', 'readVisitDailyStat', 'updateVisitDailyStat',
      'createVisitSession', 'createVisitDailyStat',
    ]);
    db.createVisitSession.and.callFake(async (session: any) => {
      await Promise.resolve();
      storedSession = session;
    });
    db.readVisitSession.and.callFake(async () => storedSession);
    db.updateVisitSession.and.resolveTo();
    db.readVisitDailyStat.and.callFake(async () => dailyStat);
    db.createVisitDailyStat.and.callFake(async (stat: any) => { dailyStat = stat; });
    db.updateVisitDailyStat.and.resolveTo();
    const service = new PageViewService(db);

    await Promise.all([
      service.trackVisit('/front/accueil'),
      service.trackVisit('/front/actualites'),
    ]);

    expect(db.createVisitSession).toHaveBeenCalledTimes(1);
    expect(db.createVisitSession.calls.mostRecent().args[0].memberId).toBeUndefined();
    expect(db.createVisitSession.calls.mostRecent().args[0].ttl).toEqual(jasmine.any(Number));
    expect(db.createVisitDailyStat).toHaveBeenCalledTimes(1);
    expect(db.updateVisitDailyStat).not.toHaveBeenCalled();
  });

  it('computes mutually exclusive visit counts from sessions', async () => {
    const db = jasmine.createSpyObj('DBhandler', ['listVisitSessions']);
    db.listVisitSessions.and.returnValue(of([
      { sessionId: 'member', date: '2026-09-04', yearMonth: '2026-09', authenticated: true, groupName: Group_names.Member, section: 'front' },
      { sessionId: 'support', date: '2026-09-04', yearMonth: '2026-09', authenticated: true, groupName: Group_names.Support, section: 'front' },
      { sessionId: 'editor', date: '2026-09-04', yearMonth: '2026-09', authenticated: true, groupName: Group_names.Editor, section: 'front' },
      { sessionId: 'admin', date: '2026-09-04', yearMonth: '2026-09', authenticated: true, groupName: Group_names.Admin, section: 'front' },
      { sessionId: 'system', date: '2026-09-04', yearMonth: '2026-09', authenticated: true, groupName: Group_names.System, section: 'front' },
      { sessionId: 'anonymous', date: '2026-09-04', yearMonth: '2026-09', authenticated: false, section: 'front' },
    ]));
    const service = new PageViewService(db);

    const stats = await firstValueFrom(service.getStats(['2026-09']));

    expect(stats.byMonth[0]).toEqual({
      yearMonth: '2026-09',
      total: 6,
      authenticated: 5,
      members: 1,
      staff: 4,
      anonymous: 1,
    });
  });
});