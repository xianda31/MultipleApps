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
  standalone: true,
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

  // Download all files in a root as a .zip archive
  async downloadRootZip(root: string) {
    // Dynamically import JSZip for Angular compatibility
    const JSZip = (await import('jszip')).default;
    const entry = this.roots.find(r => r.key === root);
    if (!entry || entry.sourceCount === 0 || entry.sourceCount === null) {
      this.toastService.showErrorToast('Téléchargement', 'Aucun fichier à télécharger pour cette racine.');
      return;
    }
    try {
      const prefix = this.sourcePrefix(root);
      let files: any[] = [];
      if (this.sourceBucket) {
        files = await this.s3.listAllObjects(this.sourceBucket, prefix);
        files = files.filter(f => (f.Size || 0) > 0);
      } else {
        files = await firstValueFrom(this.fileService.list_files(prefix));
        files = files.filter(f => f.size && f.size > 0);
      }
      if (!files.length) {
        this.toastService.showErrorToast('Téléchargement', 'Aucun fichier trouvé.');
        return;
      }
      const zip = new JSZip();
      // Fetch and add each file to the zip
      for (const file of files) {
        let filePath = file.Key || file.path;
        let fileName = filePath.split('/').pop();
        try {
          let blob: Blob;
          if (this.sourceBucket) {
            // Utilise FileService.getPresignedUrl$ pour obtenir l'URL signée compatible Angular
            const url = await firstValueFrom(this.fileService.getPresignedUrl$(filePath));
            const resp = await fetch(url);
            blob = await resp.blob();
          } else {
            blob = await this.fileService.download_file(filePath);
          }
          zip.file(fileName, blob);
        } catch (err) {
          console.warn('Erreur téléchargement', filePath, err);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${root}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      this.toastService.showSuccess('Téléchargement', `Archive ${root}.zip générée (${files.length} fichiers)`);
    } catch (err) {
      console.error('Erreur lors du téléchargement .zip', err);
      this.toastService.showErrorToast('Téléchargement', 'Erreur lors de la génération de l’archive.');
    }
  }


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
