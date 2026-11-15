import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { TournamentService } from '../../../common/services/tournament.service';
import { MembersService } from '../../../common/services/members.service';
import { PdfService } from '../../../common/services/pdf.service';
import { SystemDataService } from '../../../common/services/system-data.service';
import { ToastService } from '../../../common/services/toast.service';
import { ProductService } from '../../../common/services/product.service';
import { BreakingNewsService } from '../../breaking-news/breaking-news.service';
import { FEE_RATE, Game, Gamer, Game_status } from '../fees.interface';
import { FeesCollectorComponent } from './fees-collector.component';
import { FeesCollectorService } from './fees-collector.service';
import { FFB_proxyService } from '../../../common/ffb/services/ffb.service';
import { ClubMember } from '../../../common/ffb/interface/club-member.interface';
import { rosterSignature } from './fees-pairs.util';

describe('FeesCollectorComponent player cards', () => {
  it('renders progress, player status and the quick-sale action without selecting a payment', async () => {
    registerLocaleData(localeFr);
    const gamer: Gamer = {
      license: '00000001', firstname: 'Jean', lastname: 'DUPONT', is_member: true,
      game_credits: 0, debt: 2, credit: 0, index: 0, in_euro: false, price: 3,
      validated: false, enabled: true, photo_url$: null, member_id: '1', my_birthday: null,
    };
    const game: Game = {
      season: '2026', fee_rate: FEE_RATE.STANDARD, member_trn_price: 3,
      non_member_trn_price: 5, fees_doubled: false, alphabetic_sort: false,
      tournament: { id: 1, name: 'Tournoi', date: '2026-11-15', time: '14:00' },
      gamers: [gamer, { ...gamer, index: 1, license: '00000002', firstname: 'Anne', validated: true, enabled: false }],
    };
    let hideValidated = false;
    const feesService = {
      game$: new BehaviorSubject(game),
      get_tournament: () => ({ id: 1, status: Game_status.RECOVERED }),
      get_view_preferences: () => ({ hideValidated }),
      set_hide_validated: (hidden: boolean) => hideValidated = hidden,
      stamps_collected: () => 0,
      euros_collected: () => 0,
      paymentPreference: 'card',
      addPair: jasmine.createSpy().and.resolveTo(true),
      replacePlayer: jasmine.createSpy().and.resolveTo(true),
      removePair: jasmine.createSpy().and.resolveTo(true),
    };
    await TestBed.configureTestingModule({
      imports: [FeesCollectorComponent],
      providers: [
        { provide: FeesCollectorService, useValue: feesService },
        { provide: TournamentService, useValue: { list_next_tournaments: () => of([]) } },
        { provide: MembersService, useValue: { listMembers: () => of([]) } },
        { provide: SystemDataService, useValue: { get_configuration: () => of({ banks: [], membership_payment_warning_month: 12 }) } },
        { provide: ProductService, useValue: { listProducts: () => of([{ account: 'CAR', paired: false, price: 10 }]) } },
        { provide: BreakingNewsService, useValue: { activate: () => {}, deactivate: () => {} } },
        { provide: PdfService, useValue: {} },
        { provide: NgbModal, useValue: {} },
        { provide: ToastService, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: FFB_proxyService, useValue: {} },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(FeesCollectorComponent);
    fixture.detectChanges();

    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.fee-player-card'));
    expect(fixture.nativeElement.querySelector('.fee-progress').textContent).toContain('1 / 2 pointés');
    for (const [credits, label] of [[0, '0 crédit'], [1, '1 crédit'], [2, '2 crédits']] as const) {
      gamer.game_credits = credits;
      fixture.detectChanges();
      expect(cards[0].querySelector('.fee-credit-badge')!.textContent!.trim()).toBe(label);
    }
    gamer.game_credits = 0;
    fixture.detectChanges();
    expect(cards[0].textContent).toContain('Dette');
    expect(cards[0].querySelector('.quick-sale-btn')).not.toBeNull();
    expect(cards[1].classList.contains('is-checked-in')).toBeTrue();
    expect(cards[1].querySelector('.fee-checkin-button')!.textContent!.trim()).toBe('Offert');
    expect(cards[1].querySelector('.quick-sale-btn')).toBeNull();

    const setPayment = spyOn(fixture.componentInstance, 'setGamerPayment');
    cards[0].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    fixture.detectChanges();
    expect(setPayment).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Offert');
    feesService.paymentPreference = 'euro';
    fixture.detectChanges();
    cards[0].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    expect(setPayment).toHaveBeenCalledOnceWith(gamer, 'euro');
    gamer.game_credits = 10;
    feesService.paymentPreference = 'card';
    fixture.detectChanges();
    setPayment.calls.reset();
    cards[0].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    expect(setPayment).toHaveBeenCalledOnceWith(gamer, 'card');
    feesService.paymentPreference = 'euro';
    fixture.detectChanges();
    setPayment.calls.reset();
    cards[0].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    expect(setPayment).toHaveBeenCalledOnceWith(gamer, 'euro');
    const cancelCheckIn = spyOn(fixture.componentInstance, 'cancelCheckIn');
    cards[1].querySelector<HTMLButtonElement>('.fee-checkin-button')!.click();
    expect(cancelCheckIn).toHaveBeenCalledOnceWith(game.gamers[1]);
    for (const alphabeticSort of [false, true]) {
      game.alphabetic_sort = alphabeticSort;
      fixture.nativeElement.querySelector('#gamerFilterPending').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.fee-player-card').length).toBe(1);
      expect(fixture.nativeElement.querySelector('.fee-player-name').textContent).toContain('Jean');
      feesService.game$.next(game);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.fee-player-card').length).toBe(1);
      fixture.nativeElement.querySelector('#gamerFilterAll').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.fee-player-card').length).toBe(2);
    }
    const component = fixture.componentInstance;
    const footerActions = fixture.nativeElement.querySelector('.fees-footer-actions');
    expect(footerActions.querySelectorAll('button').length).toBe(4);
    expect(footerActions.textContent).toContain('pointages');
    const managementButton = footerActions.querySelector('button');
    expect(managementButton.textContent).toContain('Gérer les paires');
    expect(fixture.nativeElement.querySelector('.fees-collector-header').textContent).not.toContain('Ajouter une paire');
    managementButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.fee-pair-row').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.fee-pair-row .btn-outline-danger').disabled).toBeTrue();
    const replacement: ClubMember = {
      id: 3, license_number: '00000003', firstName: 'Paul', lastName: 'MARTIN',
      gender: 'M', birthdate: '', licence: true, season: { id: 1, category: 'senior' },
      mainRegistration: { free: false },
      club: { id: 1, ffbCode: '', name: '', label: '', type: '',
        committee: { id: 1, label: '', zone: { id: 1, label: '' } } },
    };
    fixture.nativeElement.querySelector('[aria-label="Remplacer Jean DUPONT"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-input-player[listeId="replacement_player"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#player1')).toBeNull();
    component.replacementPlayer = replacement;
    await component.confirmPairChange();
    expect(feesService.replacePlayer).toHaveBeenCalledOnceWith(gamer.license, replacement, rosterSignature(game.gamers));
    component.beginAddPair();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-input-player').length).toBe(2);
    await component.confirmPairChange();
    expect(feesService.addPair).not.toHaveBeenCalled();
    component.new_pair_player1 = replacement;
    component.new_pair_player2 = { ...replacement, id: 4, license_number: '00000004' };
    await component.confirmPairChange();
    expect(feesService.addPair).toHaveBeenCalledOnceWith(component.new_pair_player1 ?? replacement,
      jasmine.objectContaining({ id: 4 }), rosterSignature(game.gamers));
    game.gamers[1].validated = false;
    component.beginRemovePair(component.pairs[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert-warning').textContent).toContain('Anne');
    await component.confirmPairChange();
    expect(feesService.removePair).toHaveBeenCalledOnceWith('legacy-0', rosterSignature(game.gamers));
    component.closePairsModal();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-labelledby="pairsModalTitle"]')).toBeNull();
    fixture.destroy();
  });
});
