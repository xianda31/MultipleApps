import { TournamentTeams } from '../../ffb/interface/tournament.interface';
import { buildTournamentCalendar, compactTournamentName, tournamentCalendarRange } from './tournaments.component';

describe('buildTournamentCalendar', () => {
  it('groups tournaments by month, week and Monday-Wednesday-Friday columns', () => {
    const calendar = buildTournamentCalendar([
      tournament(1, '2026-10-26T14:30:00'),
      tournament(2, '2026-10-28T14:30:00'),
      tournament(3, '2026-11-02T14:30:00'),
    ]);

    expect(calendar.map((month) => month.key)).toEqual(['2026-10', '2026-11']);
    expect(calendar[0].weeks.length).toBe(1);
    expect(calendar[0].weeks[0].days.map((day) => day.tournaments.length)).toEqual([1, 1, 0]);
    expect(calendar[1].weeks[0].days.map((day) => day.tournaments.length)).toEqual([1, 0, 0]);
  });

  it('keeps multiple tournaments scheduled on the same day', () => {
    const calendar = buildTournamentCalendar([
      tournament(1, '2026-10-30T10:00:00'),
      tournament(2, '2026-10-30T14:30:00'),
    ]);

    expect(calendar[0].weeks[0].days[2].tournaments.map((item) => item.tournament.id)).toEqual([1, 2]);
  });

  it('does not place an unexpected weekday in the three-column calendar', () => {
    const calendar = buildTournamentCalendar([
      tournament(1, '2026-10-27T14:30:00'),
    ]);

    expect(calendar).toEqual([]);
  });

  it('removes redundant tournament weekdays from compact portrait names', () => {
    expect(compactTournamentName('Vendredi - Tournoi de régularité')).toBe('Tournoi de régularité');
    expect(compactTournamentName('mercredi : Rondes de France')).toBe('Rondes de France');
    expect(compactTournamentName('LUNDI Simultané national')).toBe('Simultané national');
    expect(compactTournamentName('Simultané du lundi')).toBe('Simultané du lundi');
  });

  function tournament(id: number, date: string): TournamentTeams {
    return {
      tournament: {
        id,
        date,
        title: `Tournoi ${id}`,
        entryCount: 0,
      },
      items: [],
    };
  }
});

describe('tournamentCalendarRange', () => {
  const today = new Date(2026, 9, 24);
  const seasonEnd = new Date(2027, 5, 30, 23, 59, 59, 999);

  it('starts the first two-month period on the current day', () => {
    const range = tournamentCalendarRange(today, 0, seasonEnd);

    expect(range.start).toEqual(new Date(2026, 9, 24));
    expect(range.end).toEqual(new Date(2026, 10, 30, 23, 59, 59, 999));
  });

  it('moves forward by two full calendar months', () => {
    const range = tournamentCalendarRange(today, 2, seasonEnd);

    expect(range.start).toEqual(new Date(2026, 11, 1));
    expect(range.end).toEqual(new Date(2027, 0, 31, 23, 59, 59, 999));
  });

  it('does not extend beyond the end of the season', () => {
    const range = tournamentCalendarRange(today, 8, seasonEnd);

    expect(range.start).toEqual(new Date(2027, 5, 1));
    expect(range.end).toEqual(seasonEnd);
  });
});
