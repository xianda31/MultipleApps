import { TestBed } from '@angular/core/testing';
import { FEE_RATE } from '../fees/fees.interface';
import { SystemConfiguration } from '../../common/interfaces/system-conf.interface';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';
import { SysConfComponent } from './sys-conf.component';

describe('SysConfComponent payment preferences', () => {
  it('defaults legacy fee rates to card and saves independent preferences per rate', () => {
    const systemData = jasmine.createSpyObj('SystemDataService', ['save_configuration']);
    TestBed.configureTestingModule({
      imports: [SysConfComponent],
      providers: [
        { provide: SystemDataService, useValue: systemData },
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
    component.loadDataInFormGroup(configuration);
    expect(component.systemFormGroup.get('nfc_check_in_active')!.value).toBeFalse();
    component.systemFormGroup.get('nfc_check_in_active')!.setValue(true);
    expect(component.fee_rates.at(0).get('payment_preference')!.value).toBe('card');
    expect(component.fee_rates.at(1).get('payment_preference')!.value).toBe('euro');
    component.fee_rates.at(0).get('payment_preference')!.setValue('euro');
    component.fee_rates.at(1).get('payment_preference')!.setValue('card');
    component.save_configuration();
    expect(systemData.save_configuration).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      nfc_check_in_active: true,
      fee_rates: [
        { key: FEE_RATE.STANDARD, member_price: 3, non_member_price: 5, payment_preference: 'euro' },
        { key: FEE_RATE.HOLIDAYS, member_price: 3, non_member_price: 5, payment_preference: 'card' },
      ],
    }));
    component.loadDataInFormGroup(configuration);
    expect(component.systemFormGroup.get('nfc_check_in_active')!.value).toBeFalse();
    fixture.destroy();
  });
});
