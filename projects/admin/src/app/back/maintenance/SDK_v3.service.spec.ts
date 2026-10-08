import { BatchWriteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { BatchService } from './SDK_v3.service';

describe('BatchService', () => {
  let service: BatchService;

  beforeEach(() => {
    service = new BatchService();
  });

  it('scans every page when no limit is requested', async () => {
    const send = spyOn(service.client, 'send').and.callFake(async (command: any) => {
      const scan = command as ScanCommand;
      const startKey = scan.input.ExclusiveStartKey;
      if (!startKey) {
        return {
          Items: [{ id: { S: '1' } }],
          LastEvaluatedKey: { id: { S: '1' } },
        } as never;
      }
      return { Items: [{ id: { S: '2' } }] } as never;
    });

    const items = await firstValueFrom(service.scanTable('BookEntry-test', 0));

    expect(items.map(item => item.id.S)).toEqual(['1', '2']);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('retries only unprocessed writes', fakeAsync(() => {
    const unprocessed = { PutRequest: { Item: { id: { S: '2' } } } };
    const send = spyOn(service.client, 'send').and.callFake(async (command: any) => {
      const write = command as BatchWriteItemCommand;
      const requests = write.input.RequestItems?.['BookEntry-test'] ?? [];
      if (send.calls.count() === 1) {
        return { UnprocessedItems: { 'BookEntry-test': [unprocessed] } } as never;
      }
      expect(requests).toEqual([unprocessed]);
      return { UnprocessedItems: {} } as never;
    });

    let completed = false;
    service.batchWriteItem('BookEntry-test', [
      { id: { S: '1' } },
      { id: { S: '2' } },
    ]).subscribe({ complete: () => completed = true });
    flushMicrotasks();
    tick(3000);
    flushMicrotasks();

    expect(send).toHaveBeenCalledTimes(2);
    expect(completed).toBeTrue();
  }));
});
