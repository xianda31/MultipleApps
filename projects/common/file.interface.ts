export interface S3Item {
    path: string;
    etag?: string;
    lastModified?: Date | undefined;
    size?: number;
    url?: Promise<URL>;
    usage?: number;
}