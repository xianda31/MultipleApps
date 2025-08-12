import { Component } from '@angular/core';
import { FileService } from '../../../common/services/files.service';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../common/services/toast.service';
import { Snippet, SNIPPET_TEMPLATES } from '../../../common/interfaces/snippet.interface';
import { SnippetService } from '../../../common/services/snippet.service';
import { TitleService } from '../../title.service';

@Component({
  selector: 'app-documents',
  imports: [CommonModule],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss'
})
export class DocumentsComponent {

  snippets: Snippet[] = [];
  documents : { name: string; url: string ; summary: string ; icon: string }[] = [];
  documents_path = 'documents/';
  icons: {[key: string]: string} = {
    pdf: 'bi-file-earmark-pdf-fill',
    word: 'bi-file-earmark-word-fill',
    excel: 'bi-file-earmark-excel-fill',
    powerpoint: 'bi-file-earmark-powerpoint-fill',
    unknown: 'bi-file-earmark-fill'
  };

  constructor(
    private snippetService : SnippetService,
    private titleService: TitleService,
    private fileService: FileService,
    private toastService: ToastService
  ) { }

ngOnInit():void {
 this.titleService.setTitle('Le Club - documents');

  this.snippetService.listSnippets().subscribe(snippets => {
    this.snippets = snippets.filter(snippet => snippet.template === SNIPPET_TEMPLATES.DOCUMENTS);
    this.documents = this.snippets.map(snippet => ({
      name: snippet.title,
      url: this.documents_path + snippet.subtitle,
      summary: snippet.content,
      icon: this.doc_icon(snippet.subtitle)
    }));
  });
}

doc_icon(file: string): string {
  const fileType = file.split('.').pop() || '';
  const icon = Object.keys(this.icons).find(key => key === fileType);
  return icon ? this.icons[icon] : this.icons['unknown'];
}

  async downloadDocument(docItem: { name: string; url: string }) {
    try {
      const blob = await this.fileService.downloadBlob(docItem.url);
      const a = window.document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = docItem.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(a.href);
    } catch (error) {
      this.toastService.showErrorToast('Erreur lors du téléchargement', docItem.name + ' n\'est pas disponible');
    }
  }

}
