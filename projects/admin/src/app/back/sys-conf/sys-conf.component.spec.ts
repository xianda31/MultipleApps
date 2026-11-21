import { TestBed } from '@angular/core/testing';
import { FEE_RATE } from '../fees/fees.interface';
import { SystemConfiguration } from '../../common/interfaces/system-conf.interface';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';
import { SysConfComponent } from './sys-conf.component';
import { FFB_proxyService } from '../../common/ffb/services/ffb.service';
import { of } from 'rxjs';

describe('SysConfComponent payment preferences', () => {
  it('defaults legacy fee rates to card and saves independent preferences per rate', async () => {
    const systemData = jasmine.createSpyObj('SystemDataService', ['save_configuration', 'get_configuration']);
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: systemData },
        { provide: FFB_proxyService, useValue: jasmine.createSpyObj('FFB_proxyService', ['validateClubIdentity']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['showSuccess', 'showWarning']) },
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
    expect(fixture.nativeElement.querySelector('#ffbClubCode').value).toBe('5500020');
    expect(fixture.nativeElement.querySelector('#ffbOrganizationId').value).toBe('1403');
    expect(component.fee_rates.at(0).get('payment_preference')!.value).toBe('card');
    expect(component.fee_rates.at(1).get('payment_preference')!.value).toBe('euro');
    component.fee_rates.at(0).get('payment_preference')!.setValue('euro');
    component.fee_rates.at(1).get('payment_preference')!.setValue('card');
    await component.save_configuration();
    expect(systemData.save_configuration).toHaveBeenCalledOnceWith(jasmine.objectContaining({
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
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: systemData },
        { provide: FFB_proxyService, useValue: ffb },
        { provide: ToastService, useValue: toast },
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

    ffb.validateClubIdentity.and.resolveTo();
    systemData.save_configuration.and.resolveTo();
    await component.save_configuration();
    expect(systemData.save_configuration).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      ffb_club_code: '5500055', ffb_organization_id: '1438',
    }));
  });
});
