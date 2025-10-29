import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../common/services/toast.service';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { firstValueFrom } from 'rxjs';
import { S3CloneService } from '../s3-clone.service';


@Component({
  selector: 'app-clone-s3',
  imports: [CommonModule, FormsModule],
  templateUrl: './clone-s3.component.html',
  styleUrl: './clone-s3.component.scss'
})
export class CloneS3Component {
  // UI state
  started = false;
  production_apid = environment.production_apid; // shown for parity with DB clone page header
  sandbox_apid = environment.sandbox_apid;

  // No base prefix: clone to destination root per folder

  // Buckets (required for cross-bucket copy)
  sourceBucket = '';
  destBucket = '';

  // Roots available in storage policy
  roots: Array<{ key: string; selected: boolean; sourceCount: number | null; destCount: number | null; cloning: boolean; progress: number; errors: number; }>
    = Object.values(S3_ROOT_FOLDERS).map(key => ({ key, selected: true, sourceCount: null, destCount: null, cloning: false, progress: 0, errors: 0 }));

  constructor(
    private fileService: FileService,
    private s3: S3CloneService,
    private toastService: ToastService
  ) { }


  async ngOnInit() {
    // Default buckets from environment if provided
    this.sourceBucket = (environment as any).s3_prod_bucket || '';
    this.destBucket = (environment as any).s3_sandbox_bucket || '';
    // Populate counts initially (non-blocking)
    this.refreshCounts();
  }

  // Compute concrete source/destination prefixes for a root (ensures trailing slash)
  private sourcePrefix(root: string): string {
    // Always root-level on source bucket
    return `${root}/`;
  }
  private destPrefix(root: string): string {
    return `${root}/`;
  }

  async refreshCounts() {
    for (const entry of this.roots) {
      const src = this.sourcePrefix(entry.key);
      const dst = this.destPrefix(entry.key);
      try {
        // Cross-bucket listing via SDK service; require bucket inputs in UI
        if (this.sourceBucket && this.destBucket) {
          const [srcObjs, dstObjs] = await Promise.all([
            this.s3.listAllObjects(this.sourceBucket, src),
            this.s3.listAllObjects(this.destBucket, dst)
          ]);
          entry.sourceCount = srcObjs.filter(o => (o.Size || 0) > 0).length;
          entry.destCount = dstObjs.filter(o => (o.Size || 0) > 0).length;
        } else {
          // Fallback to current-bucket listing if buckets not set
          const [srcItems, dstItems] = await Promise.all([
            firstValueFrom(this.fileService.list_files(src)),
            firstValueFrom(this.fileService.list_files(dst))
          ]);
          entry.sourceCount = srcItems.filter(i => i.size && i.size > 0).length;
          entry.destCount = dstItems.filter(i => i.size && i.size > 0).length;
        }
      } catch (e) {
        entry.sourceCount = entry.sourceCount ?? 0;
        entry.destCount = entry.destCount ?? 0;
        console.warn('Failed listing for', entry.key, e);
      }
    }
  }

  private getContentTypeFromPath(path: string, fallback = 'application/octet-stream'): string {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'webp': return 'image/webp';
      case 'svg': return 'image/svg+xml';
      case 'pdf': return 'application/pdf';
      case 'txt': return 'text/plain';
      case 'json': return 'application/json';
      default: return fallback;
    }
  }

  // Delete all files under destination prefix for a given root
  private async deleteDestination(root: string) {
    if (!this.destBucket) throw new Error('Destination bucket non défini');
    const dst = this.destPrefix(root);
    await this.s3.deletePrefix(this.destBucket, dst);
  }

  // Clone (copy) all files from source to destination for a given root
  async cloneRoot(root: string, alsoDeleteDest = true) {
    const entry = this.roots.find(r => r.key === root)!;
    if (entry.cloning) return;
    entry.cloning = true;
    entry.progress = 0;
    entry.errors = 0;
    this.started = true;

    try {
      const src = this.sourcePrefix(root);
      const dst = this.destPrefix(root);
      if (src === dst && this.sourceBucket === this.destBucket) {
        this.toastService.showErrorToast('Clone S3', `Source et destination identiques pour ${root}. Modifiez les préfixes.`);
        return;
      }

      if (!this.sourceBucket || !this.destBucket) {
        this.toastService.showErrorToast('Clone S3', 'Veuillez renseigner les noms de buckets source et destination.');
        return;
      }

      if (alsoDeleteDest) {
        await this.deleteDestination(root);
      }
      const res = await this.s3.copyPrefix(this.sourceBucket, src, this.destBucket, dst, (done, total) => {
        entry.progress = Math.round((done / total) * 100);
      });
      entry.errors = res.errors;
      this.toastService.showSuccess('Clone S3', `Dossier ${root} cloné (${res.total - res.errors}/${res.total})`);
    } catch (e) {
      console.error('Clone error', root, e);
      this.toastService.showErrorToast('Clone S3', `Erreur lors du clonage du dossier ${root}`);
    } finally {
      entry.cloning = false;
      this.started = false;
      // Refresh counts after operation
      this.refreshCounts();
    }
  }

  // Clone all selected roots
  async cloneSelected(alsoDeleteDest = true) {
    this.started = true;
    for (const entry of this.roots.filter(r => r.selected)) {
      await this.cloneRoot(entry.key, alsoDeleteDest);
    }
    this.started = false;
  }
}
