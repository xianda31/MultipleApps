import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { FEE_RATE } from '../fees/fees.interface';
import { SystemConfiguration } from '../../common/interfaces/system-conf.interface';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';
import { SysConfComponent } from './sys-conf.component';
import { FFB_proxyService } from '../../common/ffb/services/ffb.service';
import { of } from 'rxjs';
import { ModalDismissReasons, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetConfirmationComponent } from '../../common/modals/get-confirmation.component';

describe('SysConfComponent payment preferences', () => {
  it('defaults legacy fee rates to card and saves independent preferences per rate', async () => {
    const systemData = jasmine.createSpyObj('SystemDataService', ['save_configuration', 'get_configuration']);
    const ffb = jasmine.createSpyObj('FFB_proxyService', ['validateClubIdentity', 'searchClubs']);
    const modal = jasmine.createSpyObj('NgbModal', ['open']);
    ffb.validateClubIdentity.and.resolveTo('Bridge Club de Saint Orens');
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: systemData },
        { provide: FFB_proxyService, useValue: ffb },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['showSuccess', 'showWarning']) },
        { provide: NgbModal, useValue: modal },
      ],
    });
    const fixture = TestBed.createComponent(SysConfComponent);
    const component = fixture.componentInstance;
    const configuration: SystemConfiguration = {
      club_identifier: 'club', trace_mode: false, club_bank_key: '',
      online_payment_active: false, tpe_payment_active: false, CB_fees_account: '',
      minimum_cb_amount: 0,
      fee_rates: [
        { key: FEE_RATE.STANDARD, member_price: 3, non_member_price: 5 },
        { key: FEE_RATE.HOLIDAYS, member_price: 3, non_member_price: 5, payment_preference: 'euro' },
      ],
      revenue_and_expense_tree: { sections: [], revenues: [], expenses: [] },
      profit_and_loss: { debit_key: '', credit_key: '' },
      banks: [],
    };
    systemData.get_configuration.and.returnValue(of(configuration));
    fixture.detectChanges();
    expect(component.systemFormGroup.get('ffb_club_code')?.value).toBe('5500020');
    expect(component.systemFormGroup.get('ffb_organization_id')?.value).toBe('1403');
    expect(component.fee_rates.at(0).get('payment_preference')!.value).toBe('card');
    expect(component.fee_rates.at(1).get('payment_preference')!.value).toBe('euro');
    component.fee_rates.at(0).get('payment_preference')!.setValue('euro');
    component.fee_rates.at(1).get('payment_preference')!.setValue('card');
    await component.save_configuration();
    expect(modal.open).not.toHaveBeenCalled();
    expect(systemData.save_configuration).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      ffb_club_name: 'Bridge Club de Saint Orens',
      fee_rates: [
        { key: FEE_RATE.STANDARD, member_price: 3, non_member_price: 5, payment_preference: 'euro' },
        { key: FEE_RATE.HOLIDAYS, member_price: 3, non_member_price: 5, payment_preference: 'card' },
      ],
    }));
    fixture.destroy();
  });

  it('validates changed FFB identifiers before saving and reports failures', async () => {
    const systemData = jasmine.createSpyObj('SystemDataService', ['save_configuration']);
    const ffb = jasmine.createSpyObj('FFB_proxyService', ['validateClubIdentity']);
    const toast = jasmine.createSpyObj('ToastService', ['showSuccess', 'showWarning', 'showError']);
    const modal = jasmine.createSpyObj('NgbModal', ['open']);
    modal.open.and.callFake(() => ({ componentInstance: {}, result: Promise.resolve(true) }));
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: systemData },
        { provide: FFB_proxyService, useValue: ffb },
        { provide: ToastService, useValue: toast },
        { provide: NgbModal, useValue: modal },
      ],
    });
    const component = TestBed.createComponent(SysConfComponent).componentInstance;
    component.systemFormGroup.patchValue({ ffb_club_code: '5500055', ffb_organization_id: '1438' });
    ffb.validateClubIdentity.and.rejectWith(new Error('identifiants incompatibles'));
    spyOn(console, 'error');

    await component.save_configuration();
    expect(ffb.validateClubIdentity).toHaveBeenCalledOnceWith('5500055', '1438');
    expect(systemData.save_configuration).not.toHaveBeenCalled();
    expect(toast.showError).toHaveBeenCalled();

    ffb.validateClubIdentity.and.resolveTo('Club sélectionné');
    systemData.save_configuration.and.resolveTo();
    await component.save_configuration();
    expect(systemData.save_configuration).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      ffb_club_code: '5500055', ffb_organization_id: '1438', ffb_club_name: 'Club sélectionné',
    }));
  });

  it('searches and selects a paginated club, then saves the verified official name and identifiers', async () => {
    const systemData = jasmine.createSpyObj('SystemDataService', ['save_configuration', 'get_configuration']);
    const ffb = jasmine.createSpyObj('FFB_proxyService', ['validateClubIdentity', 'searchClubs']);
    const toast = jasmine.createSpyObj('ToastService', ['showSuccess', 'showWarning', 'showError']);
    const modal = jasmine.createSpyObj('NgbModal', ['open']);
    modal.open.and.callFake(() => ({ componentInstance: {}, result: Promise.resolve(true) }));
    const configuration: SystemConfiguration = {
      club_identifier: 'club', trace_mode: false, club_bank_key: '',
      ffb_club_code: '5500020', ffb_organization_id: '1403', ffb_club_name: 'Club actuel',
      online_payment_active: false, tpe_payment_active: false, CB_fees_account: '', minimum_cb_amount: 0,
      fee_rates: [], revenue_and_expense_tree: { sections: [], revenues: [], expenses: [] },
      profit_and_loss: { debit_key: '', credit_key: '' }, banks: [],
    };
    systemData.get_configuration.and.returnValue(of(configuration));
    systemData.save_configuration.and.resolveTo();
    ffb.validateClubIdentity.and.resolveTo('Nom officiel vérifié');
    ffb.searchClubs.and.callFake(async (_label: string, page: number) => ({
      clubs: page === 1
        ? [{ name: 'Premier club', code: '5500020', organizationId: '1403' }]
        : [{ name: 'Autre club', code: '5500055', organizationId: '1438' }],
      hasNextPage: page === 1,
    }));
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: systemData },
        { provide: FFB_proxyService, useValue: ffb },
        { provide: ToastService, useValue: toast },
        { provide: NgbModal, useValue: modal },
      ],
    });
    const fixture = TestBed.createComponent(SysConfComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const firstHeader = root.querySelector('.card-header')!;
    expect(firstHeader.textContent).toContain('Club FFB : Club actuel');
    expect(firstHeader.textContent).toContain('5500020');
    expect(firstHeader.textContent).toContain('1403');

    component.onClubSearchChange('  club  ');
    await component.searchClubs();
    expect(ffb.searchClubs).toHaveBeenCalledWith('club', 1);
    expect(component.clubSearchHasNextPage).toBeTrue();
    fixture.detectChanges();
    const next = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Suivant')!;
    next.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(ffb.searchClubs).toHaveBeenCalledWith('club', 2);
    const option: HTMLButtonElement = fixture.nativeElement.querySelector('[role="option"]');
    expect(option.textContent).toContain('Autre club');
    option.click();
    expect(component.systemFormGroup.get('ffb_club_name')?.value).toBe('Autre club');
    expect(component.systemFormGroup.dirty).toBeTrue();
    fixture.detectChanges();
    expect(firstHeader.textContent).toContain('Club FFB : Autre club');
    expect(firstHeader.textContent).toContain('5500055');
    expect(firstHeader.textContent).toContain('1438');
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();

    await component.save_configuration();
    expect(ffb.validateClubIdentity).toHaveBeenCalledOnceWith('5500055', '1438');
    expect(systemData.save_configuration).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      ffb_club_code: '5500055', ffb_organization_id: '1438', ffb_club_name: 'Nom officiel vérifié',
    }));
    fixture.destroy();
  });

  it('requires explicit confirmation before saving a different club', async () => {
    const systemData = jasmine.createSpyObj('SystemDataService', ['save_configuration']);
    const ffb = jasmine.createSpyObj('FFB_proxyService', ['validateClubIdentity']);
    const toast = jasmine.createSpyObj('ToastService', ['showSuccess', 'showWarning', 'showError']);
    const modal = jasmine.createSpyObj('NgbModal', ['open']);
    const dialog = { componentInstance: { title: '', subtitle: '', message: '' }, result: Promise.resolve(false) };
    modal.open.and.returnValue(dialog);
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: systemData },
        { provide: FFB_proxyService, useValue: ffb },
        { provide: ToastService, useValue: toast },
        { provide: NgbModal, useValue: modal },
      ],
    });
    const fixture = TestBed.createComponent(SysConfComponent);
    const component = fixture.componentInstance;
    component.selectClub({ name: 'Autre club', code: '5500055', organizationId: '1438' });

    await component.save_configuration();
    expect(modal.open).toHaveBeenCalledWith(GetConfirmationComponent, { centered: true });
    expect(dialog.componentInstance.subtitle).toContain('Autre club');
    expect(dialog.componentInstance.message).toContain('ne rétablit pas automatiquement');
    expect(systemData.save_configuration).not.toHaveBeenCalled();
    expect(ffb.validateClubIdentity).not.toHaveBeenCalled();
    expect(component.systemFormGroup.dirty).toBeTrue();
    expect(component.saving).toBeFalse();

    dialog.result = Promise.reject(ModalDismissReasons.ESC);
    await component.save_configuration();
    expect(systemData.save_configuration).not.toHaveBeenCalled();
    expect(toast.showError).not.toHaveBeenCalled();

    dialog.result = Promise.resolve(true);
    ffb.validateClubIdentity.and.resolveTo('Autre club');
    systemData.save_configuration.and.resolveTo();
    await component.save_configuration();
    expect(systemData.save_configuration).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      ffb_club_code: '5500055', ffb_organization_id: '1438', ffb_club_name: 'Autre club',
    }));
    fixture.destroy();
  });

  it('navigates suggestions with the keyboard, closes and reopens them, and selects with Enter', async () => {
    const systemData = jasmine.createSpyObj('SystemDataService', ['get_configuration']);
    const ffb = jasmine.createSpyObj('FFB_proxyService', ['searchClubs']);
    systemData.get_configuration.and.returnValue(of({
      club_identifier: 'club', trace_mode: false, club_bank_key: '',
      ffb_club_code: '5500020', ffb_organization_id: '1403', ffb_club_name: 'Club actuel',
      online_payment_active: false, tpe_payment_active: false, CB_fees_account: '', minimum_cb_amount: 0,
      fee_rates: [], revenue_and_expense_tree: { sections: [], revenues: [], expenses: [] },
      profit_and_loss: { debit_key: '', credit_key: '' }, banks: [],
    }));
    ffb.searchClubs.and.resolveTo({
      clubs: [
        { name: 'Premier club', code: '5500020', organizationId: '1403' },
        { name: 'Autre club', code: '5500055', organizationId: '1438' },
      ],
      hasNextPage: false,
    });
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: systemData },
        { provide: FFB_proxyService, useValue: ffb },
        { provide: ToastService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(SysConfComponent);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#ffbClubSearch');
    input.focus();
    input.value = 'club';
    input.dispatchEvent(new Event('input'));
    await fixture.componentInstance.searchClubs();
    fixture.detectChanges();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe('ffb-club-option-0');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe('ffb-club-option-1');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe('ffb-club-option-0');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.systemFormGroup.get('ffb_club_name')?.value).toBe('Autre club');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    fixture.destroy();
  });

  it('keeps suggestions closed after focus leaves while a search is pending', async () => {
    const ffb = jasmine.createSpyObj('FFB_proxyService', ['searchClubs']);
    let finish!: (value: { clubs: { name: string; code: string; organizationId: string }[]; hasNextPage: boolean }) => void;
    ffb.searchClubs.and.returnValue(new Promise(resolve => { finish = resolve; }));
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: {} },
        { provide: FFB_proxyService, useValue: ffb },
        { provide: ToastService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(SysConfComponent);
    const component = fixture.componentInstance;
    component.onClubSearchChange('club');
    const pending = component.searchClubs();
    const container = document.createElement('div');
    container.addEventListener('focusout', (event) => component.onClubSearchFocusOut(event));
    container.dispatchEvent(new FocusEvent('focusout'));
    finish({ clubs: [{ name: 'Club', code: '5500020', organizationId: '1403' }], hasNextPage: false });
    await pending;
    expect(component.clubSearchPanelVisible).toBeFalse();
    component.onClubSearchFocus();
    expect(component.clubSearchPanelVisible).toBeTrue();
    fixture.destroy();
  });

  it('retries the requested page after a search error', async () => {
    const ffb = jasmine.createSpyObj('FFB_proxyService', ['searchClubs']);
    ffb.searchClubs.and.rejectWith(new Error('FFB indisponible'));
    spyOn(console, 'error');
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: {} },
        { provide: FFB_proxyService, useValue: ffb },
        { provide: ToastService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(SysConfComponent);
    const component = fixture.componentInstance;
    component.onClubSearchChange('club');
    await component.searchClubs(2);
    expect(component.clubSearchError).toContain('Réessayez');
    ffb.searchClubs.and.resolveTo({ clubs: [], hasNextPage: false });
    component.retryClubSearch();
    await fixture.whenStable();
    expect(ffb.searchClubs).toHaveBeenCalledWith('club', 2);
    expect(component.clubSearchCompleted).toBeTrue();
    expect(component.clubSearchError).toBe('');
    fixture.destroy();
  });

  it('ignores a search response after the search text changes', async () => {
    const ffb = jasmine.createSpyObj('FFB_proxyService', ['searchClubs']);
    let finish!: (value: { clubs: { name: string; code: string; organizationId: string }[]; hasNextPage: boolean }) => void;
    ffb.searchClubs.and.returnValue(new Promise(resolve => { finish = resolve; }));
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: {} },
        { provide: FFB_proxyService, useValue: ffb },
        { provide: ToastService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(SysConfComponent);
    const component = fixture.componentInstance;
    component.onClubSearchChange('Saint');
    const pending = component.searchClubs();
    component.onClubSearchChange('Toulouse');
    finish({ clubs: [{ name: 'Ancien résultat', code: '5500020', organizationId: '1403' }], hasNextPage: false });
    await pending;

    expect(component.clubSearchResults).toEqual([]);
    expect(component.clubSearchCompleted).toBeFalse();
    expect(component.clubSearching).toBeFalse();
    fixture.destroy();
  });

  it('filters clubs after typing stops and ignores searches shorter than two characters', fakeAsync(() => {
    const ffb = jasmine.createSpyObj('FFB_proxyService', ['searchClubs']);
    ffb.searchClubs.and.resolveTo({ clubs: [], hasNextPage: false });
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: {} },
        { provide: FFB_proxyService, useValue: ffb },
        { provide: ToastService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(SysConfComponent);
    const component = fixture.componentInstance;
    component.onClubSearchChange('S');
    tick(300);
    expect(ffb.searchClubs).not.toHaveBeenCalled();

    component.onClubSearchChange('Sa');
    tick(200);
    component.onClubSearchChange('Saint');
    tick(299);
    expect(ffb.searchClubs).not.toHaveBeenCalled();
    tick(1);
    flushMicrotasks();
    expect(ffb.searchClubs).toHaveBeenCalledOnceWith('Saint', 1);
    expect(component.clubSearchCompleted).toBeTrue();
    fixture.destroy();
  }));

  it('keeps existing settings savable if the legacy club name cannot be retrieved', async () => {
    const systemData = jasmine.createSpyObj('SystemDataService', ['save_configuration', 'get_configuration']);
    const ffb = jasmine.createSpyObj('FFB_proxyService', ['validateClubIdentity']);
    const toast = jasmine.createSpyObj('ToastService', ['showSuccess', 'showWarning', 'showError']);
    systemData.get_configuration.and.returnValue(of({
      club_identifier: 'club', trace_mode: false, club_bank_key: '',
      ffb_club_code: '5500020', ffb_organization_id: '1403',
      online_payment_active: false, tpe_payment_active: false, CB_fees_account: '', minimum_cb_amount: 0,
      fee_rates: [], revenue_and_expense_tree: { sections: [], revenues: [], expenses: [] },
      profit_and_loss: { debit_key: '', credit_key: '' }, banks: [],
    }));
    systemData.save_configuration.and.resolveTo();
    ffb.validateClubIdentity.and.rejectWith(new Error('FFB indisponible'));
    spyOn(console, 'warn');
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: systemData },
        { provide: FFB_proxyService, useValue: ffb },
        { provide: ToastService, useValue: toast },
      ],
    });
    const fixture = TestBed.createComponent(SysConfComponent);
    fixture.detectChanges();

    await fixture.componentInstance.save_configuration();

    expect(systemData.save_configuration).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      ffb_club_code: '5500020', ffb_organization_id: '1403', ffb_club_name: '',
    }));
    expect(fixture.componentInstance.clubNameError).toContain('indisponible');
    fixture.destroy();
  });
});
