import { fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { Member } from '../../../common/interfaces/member.interface';
import { GameCard } from '../game-card.interface';
import { GameCardsEditorComponent } from './game-cards-editor.component';

describe('GameCardsEditorComponent synchronization', () => {
  const owner: Member = {
    id: 'member-1',
    gender: 'M',
    firstname: 'Jean',
    lastname: 'DUPONT',
    license_number: '00123456',
    birthdate: '',
    license_status: '',
    license_taken_at: '',
    membership_date: '',
    accept_mailing: false,
    city: '',
    email: '',
    phone_one: '',
  };

  it('renders cards before BookEntry synchronization completes', fakeAsync(() => {
    const cards$ = new Subject<GameCard[]>();
    const bookEntries$ = new Subject<any[]>();
    const findOrphanCards = jasmine.createSpy('findOrphanCards').and.resolveTo(new Set<string>());
    const component = new GameCardsEditorComponent(
      {
        gameCards: cards$.asObservable(),
        findOrphanCards,
      } as any,
      {} as any,
      {} as any,
      {
        list_book_entries: () => bookEntries$.asObservable(),
        is_book_entries_loaded: () => true,
      } as any,
    );
    const card = {
      id: 'card-1',
      owners: [owner],
      initial_qty: 12,
      stamps: [],
      licenses: ['00123456'],
    } as GameCard;

    component.ngOnInit();
    cards$.next([card]);
    flushMicrotasks();
    expect(findOrphanCards).not.toHaveBeenCalled();
    expect(component.cards).toEqual([card]);
    expect(component.loaded).toBeTrue();

    bookEntries$.next([{ id: 'entry-1' }]);
    flushMicrotasks();
    expect(findOrphanCards).toHaveBeenCalledTimes(1);

    bookEntries$.next([{ id: 'entry-1' }, { id: 'entry-2' }]);
    flushMicrotasks();
    expect(findOrphanCards).toHaveBeenCalledTimes(2);
    component.ngOnDestroy();
  }));

  it('ignores an older orphan check that completes after a newer one', fakeAsync(() => {
    const cards$ = new Subject<GameCard[]>();
    const bookEntries$ = new Subject<any[]>();
    let resolveFirst!: (ids: Set<string>) => void;
    const firstCheck = new Promise<Set<string>>(resolve => {
      resolveFirst = resolve;
    });
    const findOrphanCards = jasmine.createSpy('findOrphanCards').and.returnValues(
      firstCheck,
      Promise.resolve(new Set<string>()),
    );
    const component = new GameCardsEditorComponent(
      {
        gameCards: cards$.asObservable(),
        findOrphanCards,
      } as any,
      {} as any,
      {} as any,
      {
        list_book_entries: () => bookEntries$.asObservable(),
        is_book_entries_loaded: () => true,
      } as any,
    );
    const card = {
      id: 'card-1',
      owners: [owner],
      initial_qty: 12,
      stamps: [],
      licenses: ['00123456'],
    } as GameCard;

    component.ngOnInit();
    cards$.next([card]);
    bookEntries$.next([{ id: 'entry-1' }]);
    bookEntries$.next([{ id: 'entry-1' }, { id: 'entry-2' }]);
    flushMicrotasks();
    expect(component.orphanIds.size).toBe(0);

    resolveFirst(new Set(['card-1']));
    flushMicrotasks();

    expect(component.orphanIds.size).toBe(0);
    component.ngOnDestroy();
  }));
});
