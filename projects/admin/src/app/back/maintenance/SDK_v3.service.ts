import { Injectable } from '@angular/core';
import { BatchGetItemCommand, DescribeTableCommand, DescribeTableOutput, DynamoDBClient, ListTablesCommand, TransactGetItemsCommand, ScanCommand, PutItemCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { catchError, concat, concatAll, from, map, Observable, of, concat as rxConcat, lastValueFrom, toArray } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BatchService {
  client: DynamoDBClient;
  _tables: string[] = [];

  constructor() {

    this.client = new DynamoDBClient({
      region: environment.region,
      credentials: {
        accessKeyId: environment.aws_access_key_id,
        secretAccessKey: environment.aws_secret_access_key,
      }
    });
  }

  listTables(): Observable<string[]> {
    const command = new ListTablesCommand({});
    return from(this.client.send(command)).pipe(
      map((data) => {
        this._tables = data.TableNames || [];
        return this._tables;
      }),
      catchError((error) => {
        console.error('Error listing tables:', error);
        return of([]);
      })
    );
  }

  describeTable(tableName: string): Observable<any> {
    const command = new DescribeTableCommand({ TableName: tableName });
    return from(this.client.send(command)).pipe(
      map((data) => {
        return data;
      }),
      catchError((error) => {
        console.error('Error describing table:', error);
        return of(null);
      })
    );
  }

  scanTable(tableName: string, limit: number): Observable<any[]> {
    const command = new ScanCommand({
      TableName: tableName,
      Limit: (limit === 0) ? undefined : limit,
    });
    return from(this.client.send(command)).pipe(
      map((data) => {
        console.log('Scan result:', data);
        const items = data.Items || [];
        return items;
      }),
      catchError((error) => {
        console.error('Error scanning table:', error);
        return of([]);
      })
    );
  }


  batchWriteItem(tableName: string, items: any[]): Observable<any> {
    let batchWrite = (items: any[], batch_nbr: number): Observable<any> => {
      // let records = [...items];
      let records = items.map((item: any) => {
        return item;
      });
      const batchWriteItemInput = {
        RequestItems: {
          [tableName]: records.map(item => ({
            PutRequest: {
              Item: item
            }
          }))
        }
      };
      const command = new BatchWriteItemCommand(batchWriteItemInput);
      return from(this.client.send(command)).pipe(
        map((data) => {
          console.log('Batch write n° %s complete', batch_nbr + 1);
          return data;
        }),
        catchError((error) => {
          console.error('Batch write n° %s failed :', batch_nbr + 1, error);
          return of(null);
        })
      );
    }
    // Split items into chunks of 25
    const chunkSize = 25;
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    // Sequential execution, emit once at completion with all results
    return rxConcat(...chunks.map((chunk, index) => batchWrite(chunk, index))).pipe(
      toArray()
    );
  }

  batchDeleteItem(tableName: string, items: any[]): Observable<any> {
    let batchWrite = (items: any[], batch_nbr: number): Observable<any> => {
      // let records = [...items];
      let records = items.map((item: any) => {
        return {id: item.id!};
      });
      const batchWriteItemInput = {
        RequestItems: {
          [tableName]: records.map(record => ({
            DeleteRequest: {
              Key: record
            }
          }))
        }
      };

console.log('Batch delete n° %s', batch_nbr + 1, batchWriteItemInput);

      const command = new BatchWriteItemCommand(batchWriteItemInput);
      return from(this.client.send(command)).pipe(
        map((data) => {
          console.log('Batch delete n° %s complete', batch_nbr + 1);
          return data;
        }),
        catchError((error) => {
          console.error('Batch delete n° %s failed :', batch_nbr + 1, error);
          return of(null);
        })
      );
    }
    // Split items into chunks of 25
    const chunkSize = 25;
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    // Sequential execution, emit once at completion with all results
    return rxConcat(...chunks.map((chunk, index) => batchWrite(chunk, index))).pipe(
      toArray()
    );
  }


  // not validated
  getItems(tableDescriptor: DescribeTableOutput): Observable<any[]> {
    const tableName = tableDescriptor.Table?.TableName;
    if (!tableName) {
      console.error('Table name is undefined.');
      return of([]);
    }
    const keyShema = tableDescriptor.Table?.KeySchema;
    // You need to provide an array of keys to retrieve; here is an example with a placeholder key
    const batchGetItemInput = {
      RequestItems: {
        [tableName]: {
          Keys: [
            { id: { S: 'bf8f8f72-c34d-473d-9f79-22475a902d6c' } } // Replace '*' with actual key values you want to fetch
          ]
        }
      }
    };
    const command = new BatchGetItemCommand(batchGetItemInput);

    return from(this.client.send(command)).pipe(
      map((data) => {
        console.log('Record items:', data);
        // Extract the array of items for the requested table
        const items = data.Responses && data.Responses[tableName] ? data.Responses[tableName] : [];
        return items;
      }),
      catchError((error) => {
        console.error('Error getting table items:', error);
        return of([]);
      })
    );
  };


}
