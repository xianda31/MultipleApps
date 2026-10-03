import { firstValueFrom } from 'rxjs';

import { SystemConfiguration } from '../interfaces/system-conf.interface';
import { SystemDataService } from './system-data.service';

describe('SystemDataService accounting season', () => {
  function configuration(initializedSeason?: string): SystemConfiguration {
    return {
      club_identifier: 'test',
      trace_mode: false,
      club_bank_key: '',
      online_payment_active: true,
      tpe_payment_active: true,
      CB_fees_account: 'BNQ',
      minimum_cb_amount: 0,
      fee_rates: [],
      profit_and_loss: { debit_key: 'DEP', credit_key: 'REC' },
      revenue_and_expense_tree: { sections: [], revenues: [], expenses: [] },
      banks: [],
      accounting_initialized_season: initializedSeason,
    };
  }

  it('forces the previous initialized season when calendar closure is required', async () => {
    const fileService = jasmine.createSpyObj('FileService', ['download_json_file', 'upload_to_S3']);
    const service = new SystemDataService(fileService, {} as any);
    const calendarSeason = service.get_today_season();
    const previousSeason = service.previous_season(calendarSeason);
    fileService.download_json_file.and.resolveTo(configuration(previousSeason));

    await firstValueFrom(service.get_configuration());

    expect(service.get_accounting_season_state().status).toBe('closure_required');
    expect(service.get_local_season()).toBe(previousSeason);
    expect(service.can_write_accounting_season(previousSeason)).toBeFalse();
    expect(service.can_write_accounting_season(calendarSeason)).toBeFalse();
  });

  it('blocks all writes when the next season is initialized before July', async () => {
    const fileService = jasmine.createSpyObj('FileService', ['download_json_file', 'upload_to_S3']);
    const service = new SystemDataService(fileService, {} as any);
    const june = new Date(2027, 5, 30, 20);
    fileService.download_json_file.and.resolveTo(configuration('2027/2028'));

    await firstValueFrom(service.get_configuration());

    expect(service.get_accounting_season_state(june).status).toBe('preopened');
    expect(service.can_write_accounting_season('2026/2027', june)).toBeFalse();
    expect(service.can_write_accounting_season('2027/2028', june)).toBeFalse();
  });

  it('persists the initialized season before publishing it locally', async () => {
    const fileService = jasmine.createSpyObj('FileService', ['download_json_file', 'upload_to_S3']);
    const service = new SystemDataService(fileService, {} as any);
    const currentSeason = service.get_today_season();
    const nextSeason = service.next_season(currentSeason);
    fileService.download_json_file.and.resolveTo(configuration(currentSeason));
    fileService.upload_to_S3.and.resolveTo(undefined);
    await firstValueFrom(service.get_configuration());

    await service.change_to_new_season(nextSeason);

    expect(fileService.upload_to_S3).toHaveBeenCalled();
    expect(service.get_local_season()).toBe(nextSeason);
  });
});