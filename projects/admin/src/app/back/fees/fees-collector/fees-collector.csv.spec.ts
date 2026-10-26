import { Gamer } from '../fees.interface';
import { FeesCollectorComponent } from './fees-collector.component';

describe('FeesCollectorComponent CSV exports', () => {
  it('splits 15 consecutive pairs into lists A=8 and B=7', () => {
    const component = componentWithPairs(15);
    const toCsv = spyOn<any>(component, 'to_csv');

    component.export_csv_a();
    component.export_csv_b();

    expect(component.csvListPairCounts()).toEqual({ a: 8, b: 7 });
    expect(toCsv.calls.argsFor(0)).toEqual([
      '2026-11-06_liste_A_8_paires',
      [
        'L01A;L01B',
        'L02A;L02B',
        'L03A;L03B',
        'L04A;L04B',
        'L05A;L05B',
        'L06A;L06B',
        'L07A;L07B',
        'L08A;L08B',
      ],
    ]);
    expect(toCsv.calls.argsFor(1)).toEqual([
      '2026-11-06_liste_B_7_paires',
      [
        'L09A;L09B',
        'L10A;L10B',
        'L11A;L11B',
        'L12A;L12B',
        'L13A;L13B',
        'L14A;L14B',
        'L15A;L15B',
      ],
    ]);
  });

  it('uses the original pair order when the displayed gamers are sorted differently', () => {
    const component = componentWithPairs(4);
    component.game.gamers.reverse();
    const toCsv = spyOn<any>(component, 'to_csv');

    component.export_csv_all();

    expect(toCsv).toHaveBeenCalledOnceWith('2026-11-06_4_paires', [
      'L01A;L01B',
      'L02A;L02B',
      'L03A;L03B',
      'L04A;L04B',
    ]);
  });

  it('downloads the complete list and both half-lists in one action', () => {
    const component = componentWithPairs(15);
    const toCsv = spyOn<any>(component, 'to_csv');

    component.export_csv_files();

    expect(toCsv.calls.allArgs().map(args => args[0])).toEqual([
      '2026-11-06_15_paires',
      '2026-11-06_liste_A_8_paires',
      '2026-11-06_liste_B_7_paires',
    ]);
  });
});

function componentWithPairs(pairCount: number): FeesCollectorComponent {
  const component = Object.create(FeesCollectorComponent.prototype) as FeesCollectorComponent;
  const gamers: Gamer[] = [];
  for (let pair = 1; pair <= pairCount; pair++) {
    const pairNumber = String(pair).padStart(2, '0');
    gamers.push(
      { index: gamers.length, license: `L${pairNumber}A` } as Gamer,
      { index: gamers.length + 1, license: `L${pairNumber}B` } as Gamer,
    );
  }
  Object.assign(component as object, {
    game: {
      gamers,
      tournament: { date: '2026-11-06T14:30:00' },
    },
  });
  return component;
}
