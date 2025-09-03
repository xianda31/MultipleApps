import { Observable } from "rxjs";

export interface S3Item {
    path: string;
    etag?: string;
    lastModified?: Date | undefined;
    size?: number;
    url?: Observable<string>;
    // usage?: number;
}

export  interface FileSystemNode {
      [key: string]: FileSystemNode | { __data: S3Item };
    }
