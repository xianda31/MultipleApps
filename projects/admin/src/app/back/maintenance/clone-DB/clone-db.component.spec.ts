import { of, throwError } from 'rxjs';
import { CloneDBComponent } from './clone-db.component';
import { DescribeTableOutput } from '@aws-sdk/client-dynamodb';
import { maintenanceTargets } from '../../../../environments/maintenance-targets';

describe('CloneDBComponent table discovery', () => {
  function setup() {
    const batchService = jasmine.createSpyObj('BatchService', [
      'listTables', 'describeTable', 'scanTable',
    ]);
    const toast = jasmine.createSpyObj('ToastService', ['showError']);
    const component = new CloneDBComponent(batchService, toast);
    component.production_apid = maintenanceTargets.production_apid;
    component.sandbox_apid = maintenanceTargets.sandbox_apid;
    return { component, batchService, toast };
  }

  it('displays both target environments and ignores unrelated tables', () => {
    const { component, batchService } = setup();
    const prod = `Member-${component.production_apid}-NONE`;
    const sandbox = `Member-${component.sandbox_apid}-NONE`;
    batchService.listTables.and.returnValue(of([prod, sandbox, 'Unrelated-table']));
    batchService.describeTable.and.callFake((name: string) => of<DescribeTableOutput>({
      Table: { TableName: name, ItemCount: 10 },
    }));

    component.refreshTables();

    expect(component.tableRows.length).toBe(1);
    expect(component.tableRows[0].name).toBe('Member');
    expect(component.tableRows[0].production?.Table?.TableName).toBe(prod);
    expect(component.tableRows[0].sandbox?.Table?.TableName).toBe(sandbox);
    expect(batchService.describeTable).toHaveBeenCalledTimes(2);
    expect(component.started).toBeFalse();
    expect(component.loadingError).toBe('');
  });

  it('rejects placeholder identifiers before querying AWS', () => {
    const { component, batchService, toast } = setup();
    component.sandbox_apid = 'sandbox_apid_value';
    spyOn(console, 'error');

    component.refreshTables();

    expect(batchService.listTables).not.toHaveBeenCalled();
    expect(component.loadingError).toContain('Configuration CloneDB invalide');
    expect(toast.showError).toHaveBeenCalled();
    expect(component.started).toBeFalse();
  });

  [[], ['Unrelated-table']].forEach((tables) => {
    it(`reports an empty target set for ${tables.length} listed tables and allows retry`, () => {
      const { component, batchService, toast } = setup();
      batchService.listTables.and.returnValue(of(tables));
      spyOn(console, 'error');

      component.refreshTables(true);

      expect(component.loadingError).toContain('Aucune table DynamoDB');
      expect(toast.showError).toHaveBeenCalled();
      expect(component.started).toBeFalse();
      expect(batchService.describeTable).not.toHaveBeenCalled();
    });
  });

  it('shows AWS access errors rather than an empty successful result', () => {
    const { component, batchService, toast } = setup();
    batchService.listTables.and.returnValue(throwError(() => new Error('AccessDeniedException')));
    spyOn(console, 'error');

    component.refreshTables();

    expect(component.loadingError).toBe('AccessDeniedException');
    expect(toast.showError).toHaveBeenCalled();
    expect(component.started).toBeFalse();
  });

  it('reports description failures and clears stale clone selections', () => {
    const { component, batchService } = setup();
    component.selected.set('Member', true);
    batchService.listTables.and.returnValue(of([`Member-${component.production_apid}-NONE`]));
    batchService.describeTable.and.returnValue(throwError(() => new Error('Describe denied')));
    spyOn(console, 'error');

    component.refreshTables();

    expect(component.loadingError).toBe('Describe denied');
    expect(component.selected.size).toBe(0);
    expect(component.tableRows).toEqual([]);
    expect(component.started).toBeFalse();
  });
});
