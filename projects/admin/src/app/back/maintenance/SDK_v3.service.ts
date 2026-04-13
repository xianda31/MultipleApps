import { Injectable } from '@angular/core';
import { BatchGetItemCommand, DescribeTableCommand, DescribeTableOutput, DynamoDBClient, ListTablesCommand, ListTablesCommandOutput, ScanCommand, BatchWriteItemCommand, BatchWriteItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { catchError, from, map, Observable, of, throwError, concat as rxConcat, toArray, switchMap } from 'rxjs';
import { fetchAuthSession } from 'aws-amplify/auth';
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
      credentials: async () => {
        const session = await fetchAuthSession();
        const creds = session.credentials;
        if (!creds) throw new Error('No AWS credentials in session');
        return {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          sessionToken: creds.sessionToken,
          expiration: creds.expiration,
        };
      },
    });
  }

  listTables(): Observable<string[]> {
    const fetchAll = async (): Promise<string[]> => {
      let tables: string[] = [];
      let lastEvaluatedTableName: string | undefined = undefined;
      do {
        const command = new ListTablesCommand({ ExclusiveStartTableName: lastEvaluatedTableName });
        const data: ListTablesCommandOutput = await this.client.send(command);
        tables = tables.concat(data.TableNames || []);
        lastEvaluatedTableName = data.LastEvaluatedTableName;
      } while (lastEvaluatedTableName);
      return tables;
    };
    return from(fetchAll()).pipe(
      map((tables) => {
        this._tables = tables;
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
    // When limit === 0, fetch ALL items via pagination
    if (limit === 0) {
      const fetchAll = async (): Promise<any[]> => {
        let items: any[] = [];
        let lastEvaluatedKey: any = undefined;
        do {
          const command = new ScanCommand({
            TableName: tableName,
            ConsistentRead: true,
            ExclusiveStartKey: lastEvaluatedKey,
          });
          const data = await this.client.send(command);
          items = items.concat(data.Items || []);
          lastEvaluatedKey = data.LastEvaluatedKey;
        } while (lastEvaluatedKey);
        return items;
      };
      return from(fetchAll()).pipe(
        catchError((error) => {
          console.error('Error scanning table (paginated):', error);
          return of([]);
        })
      );
    } else {
      const command = new ScanCommand({
        TableName: tableName,
        ConsistentRead: true,
        Limit: limit,
      });
      return from(this.client.send(command)).pipe(
        map((data) => {
          const items = data.Items || [];
          return items;
        }),
        catchError((error) => {
          console.error('Error scanning table:', error);
          return of([]);
        })
      );
    }
  }

  scanTableBySeason(tableName: string, season: string): Observable<any[]> {
    const fetchAll = async (): Promise<any[]> => {
      let items: any[] = [];
      let lastEvaluatedKey: any = undefined;
      do {
        const command = new ScanCommand({
          TableName: tableName,
          ConsistentRead: true,
          ExclusiveStartKey: lastEvaluatedKey,
          FilterExpression: '#s = :season',
          ExpressionAttributeNames: { '#s': 'season' },
          ExpressionAttributeValues: { ':season': { S: season } },
        });
        const data = await this.client.send(command);
        items = items.concat(data.Items || []);
        lastEvaluatedKey = data.LastEvaluatedKey;
      } while (lastEvaluatedKey);
      return items;
    };
    return from(fetchAll()).pipe(
      catchError((error) => {
        console.error('Error scanning table by season:', error);
        return throwError(() => error);
      })
    );
  }

  batchWriteItem(tableName: string, items: any[]): Observable<any> {
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

    const writeChunkWithRetries = (records: any[], batch_nbr: number): Observable<BatchWriteItemCommandOutput | null> => {
      const run = async (): Promise<BatchWriteItemCommandOutput | null> => {
        let request = {
          RequestItems: {
            [tableName]: records.map(item => ({ PutRequest: { Item: item } }))
          }
        } as any;
        let attempt = 0;
        const maxAttempts = 6;
        let response: BatchWriteItemCommandOutput | null = null;
        do {
          try {
            response = await this.client.send(new BatchWriteItemCommand(request));
          } catch (err) {
            console.error(`Batch write #${batch_nbr + 1} attempt ${attempt + 1} failed:`, err);
            response = null;
          }
          const unprocessed = response?.UnprocessedItems?.[tableName] || [];
          if (unprocessed.length > 0) {
            // retry only unprocessed
            request = { RequestItems: { [tableName]: unprocessed } } as any;
            attempt++;
            const delay = Math.min(1000 * Math.pow(2, attempt), 8000) + Math.floor(Math.random() * 200);
            await sleep(delay);
          } else {
            break;
          }
        } while (attempt < 6);
        if (response) {
          console.log('Batch write n° %s complete (attempts: %s)', batch_nbr + 1, attempt + 1);
        }
        return response;
      };
      return from(run()).pipe(
        catchError((error) => {
          console.error('Batch write n° %s failed:', batch_nbr + 1, error);
          return of(null);
        })
      );
    };

    // Split items into chunks of 25
    const chunkSize = 25;
    const chunks: any[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    // Sequential execution, emit once at completion with all results
    return rxConcat(...chunks.map((chunk, index) => writeChunkWithRetries(chunk, index))).pipe(toArray());
  }

  batchDeleteItem(tableName: string, items: any[]): Observable<any> {
    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

    // Fetch key schema to build proper Keys (supports composite keys)
    return from(this.client.send(new DescribeTableCommand({ TableName: tableName }))).pipe(
      switchMap(desc => {
        const keySchema = desc.Table?.KeySchema || [];
        const keyAttrs = keySchema.map(k => k.AttributeName as string);

        const buildKey = (item: any) => {
          const key: any = {};
          for (const attr of keyAttrs) {
            key[attr] = item[attr]; // attribute value map as-is
          }
          return key;
        };

        const deleteChunkWithRetries = (chunk: any[], batch_nbr: number): Observable<BatchWriteItemCommandOutput | null> => {
          const run = async (): Promise<BatchWriteItemCommandOutput | null> => {
            let request = {
              RequestItems: {
                [tableName]: chunk.map(it => ({ DeleteRequest: { Key: buildKey(it) } }))
              }
            } as any;
            let attempt = 0;
            let response: BatchWriteItemCommandOutput | null = null;
            do {
              try {
                response = await this.client.send(new BatchWriteItemCommand(request));
              } catch (err) {
                console.error(`Batch delete #${batch_nbr + 1} attempt ${attempt + 1} failed:`, err);
                response = null;
              }
              const unprocessed = response?.UnprocessedItems?.[tableName] || [];
              if (unprocessed.length > 0) {
                request = { RequestItems: { [tableName]: unprocessed } } as any;
                attempt++;
                const delay = Math.min(1000 * Math.pow(2, attempt), 8000) + Math.floor(Math.random() * 200);
                await sleep(delay);
              } else {
                break;
              }
            } while (attempt < 6);
            if (response) {
              console.log('Batch delete n° %s complete (attempts: %s)', batch_nbr + 1, attempt + 1);
            }
            return response;
          };
          return from(run()).pipe(
            catchError((error) => {
              console.error('Batch delete n° %s failed:', batch_nbr + 1, error);
              return of(null);
            })
          );
        };

        // Split items into chunks of 25
        const chunkSize = 25;
        const chunks: any[][] = [];
        for (let i = 0; i < items.length; i += chunkSize) {
          chunks.push(items.slice(i, i + chunkSize));
        }
        return rxConcat(...chunks.map((chunk, index) => deleteChunkWithRetries(chunk, index))).pipe(toArray());
      })
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
