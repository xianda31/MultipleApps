import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@angular/core';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand, CopyObjectCommand, _Object, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class S3CloneService {
  private client: S3Client;

  async getSignedUrl(bucket: string, key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }

  constructor() {
    this.client = new S3Client({
      region: environment.region,
      credentials: {
        accessKeyId: environment.aws_access_key_id,
        secretAccessKey: environment.aws_secret_access_key,
      },
    });
  }
 
  async listAllObjects(bucket: string, prefix: string): Promise<_Object[]> {
    const results: _Object[] = [];
    let ContinuationToken: string | undefined = undefined;
    do {
      const out: ListObjectsV2CommandOutput = await this.client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken }));
      (out.Contents || []).forEach((o: _Object) => { if (o.Key) results.push(o as _Object); });
      ContinuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (ContinuationToken);
    return results;
  }

  async deletePrefix(bucket: string, prefix: string): Promise<number> {
    const objects = await this.listAllObjects(bucket, prefix);
    let count = 0;
    for (const obj of objects) {
      if (!obj.Key) continue;
      await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
      count++;
    }
    return count;
  }

  async copyPrefix(sourceBucket: string, sourcePrefix: string, destBucket: string, destPrefix: string, onProgress?: (done: number, total: number) => void): Promise<{ total: number; errors: number; }>{
    const objects = await this.listAllObjects(sourceBucket, sourcePrefix);
    const files = objects.filter(o => (o.Key || '').length > 0);
    let done = 0, errors = 0;
    for (const obj of files) {
      const key = obj.Key!;
      const rel = key.substring(sourcePrefix.length);
      const destKey = destPrefix + rel;
      try {
        await this.client.send(new CopyObjectCommand({
          Bucket: destBucket,
          Key: destKey,
          CopySource: encodeURI(`${sourceBucket}/${key}`),
          MetadataDirective: 'COPY',
        }));
      } catch (e) {
        console.error('Copy failed', key, e);
        errors++;
      } finally {
        done++;
        onProgress?.(done, files.length);
      }
    }
    return { total: files.length, errors };
  }
}
