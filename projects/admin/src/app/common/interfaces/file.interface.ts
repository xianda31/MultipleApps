import { Observable } from "rxjs";

export interface S3Item {
  path: string;
  etag?: string;
  lastModified?: Date | undefined;
  size: number;
  url?: Observable<string>;
  // usage?: number;
}

export interface FileSystemNode {
  [key: string]: FileSystemNode | { __data: S3Item };
}

export function getChildNodes(node: FileSystemNode | { __data: S3Item }): FileSystemNode | null{
  //   .map(key => node[key] as FileSystemNode);
  const result: FileSystemNode = {};
  const childs = Object.values(node) as FileSystemNode[];
  childs.forEach(child => {
    Object.entries(child)
      .filter(([key]) => key !== '__data')
      .forEach(([key, value]) => {
        result[key] = value as FileSystemNode;
      });
  });
  console.log('childs : ',result)
  return result;
}

export function isFolder(node: FileSystemNode): boolean {
  const childs = Object.values(node) as FileSystemNode[];
  const data = childs.find(child => child['__data'])?.['__data'] as unknown as S3Item;
  const size = data.size ;
  return (size === 0);
}
