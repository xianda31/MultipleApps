import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { ToastService } from '../../../../../../common/services/toast.service';
import { FileService } from '../../../../../../common/services/files.service';

@Component({
  selector: 'app-loadable-render',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loadable-render.component.html',
  styleUrls: ['./loadable-render.component.scss']
})
export class LoadableRenderComponent {
  @Input() snippets: Snippet[] = [];

  constructor(
    private fileService: FileService,
    private toastService: ToastService
  ) {}

  icons: { [key: string]: string } = {
    pdf: 'bi-file-earmark-pdf-fill',
    word: 'bi-file-earmark-word-fill',
    excel: 'bi-file-earmark-excel-fill',
    powerpoint: 'bi-file-earmark-powerpoint-fill',
    unknown: 'bi-file-earmark-fill'
  };

  trackById(index: number, item: any) {
    return item.id;
  }

  doc_icon(file: string): string {
    const fileType = file.split('.').pop() || '';
    const icon = Object.keys(this.icons).find(key => key === fileType);
    return icon ? this.icons[icon] : this.icons['unknown'];
  }

  async downloadDocument(snippet: Snippet) {
    const docItem = { name: snippet.title, url: snippet.file };
  
    try {
      const blob = await this.fileService.downloadBlob(docItem.url);
      const a = window.document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = docItem.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(a.href);
      // this.toastService.showSuccess('Documents', docItem.name + ' a bien été téléchargé');
    } catch (error) {
      this.toastService.showErrorToast('Erreur lors du téléchargement', docItem.name + ' n\'est pas disponible');
    }
  }
}
