import { Observable } from "rxjs";

export interface S3Item {
    path: string;
    etag?: string;
    lastModified?: Date | undefined;
    size?: number;
    url?: Observable<string>;
    // usage?: number;
}

export  interface FileSystemItem {
    __data: any;
    [key: string]: FileSystemItem | any;
  }

export  type FileSystem = { [key: string]: FileSystemItem };