import { Location } from '@angular/common';
import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { AuthentificationService } from '../../authentification/authentification.service';
import { CustomDropdownComponent } from '../../components/custom-dropdown/custom-dropdown.component';
import { ClubMember } from '../../ffb/interface/club-member.interface';
import { TournamentTeams } from '../../ffb/interface/tournament.interface';
import { FFB_proxyService } from '../../ffb/services/ffb.service';
import { Member } from '../../interfaces/member.interface';
import { MembersService } from '../../services/members.service';
import { ToastService } from '../../services/toast.service';
import { TournamentService } from '../../services/tournament.service';
import { TournamentComponent } from './tournament.component';
import { By } from '@angular/platform-browser';

describe('TournamentComponent team registration', () => {
  let fixture: ComponentFixture<TournamentComponent>;
  let tournamentService: jasmine.SpyObj<TournamentService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let loggedMember: BehaviorSubject<Member | null>;
  let teams: Subject<TournamentTeams>;
  const member: Member = {
    id: 'member',
    person_id: 1,
    gender: 'U',
    firstname: 'Jean',
    lastname: 'Dupont',
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
  const partner: ClubMember = {
    id: 2,
    firstName: 'Marie',
    lastName: 'Martin',
    license_number: '00654321',
    gender: 'U',
    birthdate: '',
    club: {
      id: 1, ffbCode: '', name: '', label: '', type: '',
      committee: { id: 1, label: '', zone: { id: 1, label: '' } },
    },
    licence: true,
    season: { id: 1, category: 'senior' },
    mainRegistration: { free: false },
  };

  beforeEach(async () => {
    teams = new Subject<TournamentTeams>();
    loggedMember = new BehaviorSubject<Member | null>({ ...member });
    tournamentService = jasmine.createSpyObj<TournamentService>('TournamentService', [
      'getTournamentTeams', 'getIsolatedPlayers', 'createTeam',
    ]);
    tournamentService.getTournamentTeams.and.returnValue(teams);
    tournamentService.getIsolatedPlayers.and.returnValue(of({
      items: [],
      pagination: {
        total_items: 0, total_pages: 1, current_page: 1,
        has_previous_page: false, has_next_page: false, per_page: 20,
      },
    }));
    tournamentService.createTeam.and.resolveTo(true);
    toastService = jasmine.createSpyObj<ToastService>('ToastService', [
      'showError', 'showSuccess', 'showWarning',
    ]);
    await TestBed.configureTestingModule({
      imports: [TournamentComponent],
      providers: [
        { provide: TournamentService, useValue: tournamentService },
        { provide: ToastService, useValue: toastService },
        { provide: AuthentificationService, useValue: { logged_member$: loggedMember } },
        { provide: MembersService, useValue: { listMembers: () => of([]) } },
        { provide: FFB_proxyService, useValue: {} },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ tournament_id: '123' })) } },
        { provide: Location, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TournamentComponent);
    fixture.detectChanges();
  });

  function registrationButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button.btn-primary');
  }

  function selectPartner(): void {
    const dropdown = fixture.debugElement.query(By.directive(CustomDropdownComponent));
    dropdown.componentInstance.items = [partner];
    dropdown.componentInstance.showSuggestions = true;
    fixture.detectChanges();
    dropdown.nativeElement.querySelector('li').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
  }

  it('enables registration after partner selection and sends both FFB IDs', fakeAsync(() => {
    expect(registrationButton().disabled).toBeTrue();
    selectPartner();
    expect(registrationButton().disabled).toBeFalse();

    registrationButton().click();
    fixture.detectChanges();
    expect(tournamentService.createTeam).toHaveBeenCalledOnceWith('123', [1, 2]);
    expect(registrationButton().disabled).toBeTrue();
    expect(registrationButton().textContent).toContain('Inscription en cours');
    flushMicrotasks();
    expect(toastService.showSuccess).toHaveBeenCalled();
  }));

  it('reports a missing FFB ID instead of silently ignoring the registration click', () => {
    loggedMember.next({ ...member, person_id: null });
    fixture.detectChanges();
    selectPartner();
    registrationButton().click();

    expect(tournamentService.createTeam).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Identifiant FFB introuvable');
  });

  it('prevents duplicate submissions while the request is pending', fakeAsync(() => {
    selectPartner();
    fixture.componentInstance.subscribeWithPlayer2();
    fixture.componentInstance.subscribeWithPlayer2();
    expect(tournamentService.createTeam).toHaveBeenCalledTimes(1);
    flushMicrotasks();
  }));

  it('allows retrying after the registration is refused', fakeAsync(() => {
    tournamentService.createTeam.and.resolveTo(false);
    selectPartner();
    registrationButton().click();
    flushMicrotasks();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain("L'inscription de l'équipe a été refusée");
    expect(registrationButton().disabled).toBeFalse();
    registrationButton().click();
    expect(tournamentService.createTeam).toHaveBeenCalledTimes(2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    flushMicrotasks();
  }));

  it('reports request failures and restores the registration button', fakeAsync(() => {
    tournamentService.createTeam.and.rejectWith(new Error('Network unavailable'));
    spyOn(console, 'error');
    selectPartner();
    registrationButton().click();
    flushMicrotasks();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain("L'inscription de l'équipe a échoué : Network unavailable");
    expect(registrationButton().disabled).toBeFalse();
  }));

  it('shows the FFB rejection reason without losing the partner or reporting success', fakeAsync(() => {
    const reason = 'Équipe invalide : \n83243 : Les inscriptions sont gérées par l’entité organisatrice.\n'
      + '259431 : Les inscriptions sont gérées par l’entité organisatrice.';
    tournamentService.createTeam.and.rejectWith(new Error(reason));
    spyOn(console, 'error');
    selectPartner();
    registrationButton().click();
    flushMicrotasks();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain("L'inscription de l'équipe a échoué : Équipe invalide : Les inscriptions sont gérées par l’entité organisatrice.");
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .not.toContain('83243');
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(toastService.showError).not.toHaveBeenCalled();
    expect(toastService.showSuccess).not.toHaveBeenCalled();
    expect(tournamentService.getTournamentTeams).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.player2.value).toEqual(partner);
    expect(registrationButton().disabled).toBeFalse();
  }));

  it('shows a generic inline error when the failure has no usable message', fakeAsync(() => {
    tournamentService.createTeam.and.rejectWith(new Error('  '));
    spyOn(console, 'error');
    selectPartner();
    registrationButton().click();
    flushMicrotasks();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain("L'inscription de l'équipe a échoué");
    expect(fixture.componentInstance.registeringTeam).toBeFalse();
  }));

  it('revalidates the partner when registered teams finish loading', () => {
    selectPartner();
    fixture.componentInstance.player2.markAsTouched();
    teams.next({
      tournament: { id: 123, date: '', title: '', entryCount: 1 },
      items: [{
        id: 10, iv: 0, tournamentRegistrationId: 20,
        players: [{
          id: partner.id, ffbId: 654321, firstName: 'Marie', lastName: 'Martin',
          season: { id: 1, ranking: { ic: 0, iv: 0, pe: 0, pec: 0, pp: 0, ppc: 0 } },
        }],
      }],
    });
    fixture.detectChanges();

    expect(registrationButton().disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Ce joueur est déjà inscrit');
  });

  it('initializes the partner control before synchronously cached teams are loaded', () => {
    fixture.destroy();
    tournamentService.getTournamentTeams.and.returnValue(of({
      tournament: { id: 123, date: '', title: '', entryCount: 0 }, items: [],
    }));
    fixture = TestBed.createComponent(TournamentComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
