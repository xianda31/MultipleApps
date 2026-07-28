export interface BuildInfo {
  commitHash: string;
  commitHashFull: string;
  commitMessage: string;
  branch: string;
  author: string;
  buildNumber: number | null;
  buildTimestamp: string;
  environment: string;
}
