import { AfterViewInit, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Snippet } from '../../../common/interfaces/page_snippet.interface';
import EditorJS from '@editorjs/editorjs';
// @ts-ignore
import '../../../common/editorjs-link-relative.js';
import edjsHTML from 'editorjs-html'
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Table from '@editorjs/table';
import ColorPicker, { ColorPickerWithoutSanitize } from 'editorjs-color-picker';

import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';


@Component({
  selector: 'app-snippet-modal-editor',
  imports: [CommonModule],
  templateUrl: './snippet-modal-editor.component.html',
  styleUrl: './snippet-modal-editor.component.scss'
})
export class SnippetModalEditorComponent implements AfterViewInit {
  @Input() snippet!: Snippet;
  @Output() snippetChange = new EventEmitter<Snippet | null>();
  editor!: EditorJS;
  // Toggle to choose table column strategy in generated HTML
  // false => equal width columns (default), true => minimal width columns
  useFitCols: boolean = true;
  edjsParser = edjsHTML({
    linkTool: (block: any) => {
      const url = block.data.link;
      return `<a href="${url}">${url}</a>`;
    },
    table: (block: any) => {
      const rows = block.data.content;
      if (!rows || !Array.isArray(rows)) return '';
      // Generate a compact, borderless table; class depends on toggle
      const tableClass = this.useFitCols
        ? 'table table-sm table-borderless fit-cols'
        : 'table table-sm table-borderless equal-cols';
      let html = `<table class="${tableClass}"><tbody>`;
      for (const row of rows) {
        html += '<tr>' + row.map((cell: string) => `<td>${cell}</td>`).join('') + '</tr>';
      }
      html += '</tbody></table>';
      return html;
    }
  });
  output_html!: SafeHtml;

  constructor(
    private activeModal: NgbActiveModal,
    private sanitizer:  DomSanitizer
  ) { }


  ngAfterViewInit(): void {

    const initialData = this.htmlToEditorJsBlocks(this.snippet.content);     // Convertit le HTML initial en blocks EditorJS

    this.editor = new EditorJS(
      {
        holder: 'editorjs',
        placeholder: 'Votre texte ici...',
        autofocus: true,
        tools: {
          header: {
            class: Header as any,
            inlineToolbar: true
          },
          list: {
            class: List as any,
            inlineToolbar: true
          },
          linkTool: {
            class: (window as any).LinkToolRelative,
            inlineToolbar: true
          },
          table: {
            class: Table as any,
            inlineToolbar: true
          },
                ColorPicker: {
            class: ColorPicker as any,
            config: {
              colors: ['#0d6efd', '#6c757d', '#198754', '#dc3545', '#ffc107', '#0dcaf0', '#f8f9fa', '#212529', '#eb9a87'],
            }
          },
        },
        data: initialData,
      });
  }

  closeModal(): void {
      this.activeModal.close(null);
    }

  async saveSnippet(): Promise<void> {
    try {
      const data = await this.editor.save();
      const parsed = this.edjsParser.parse(data); // Convertit les blocks EditorJS en HTML
      // edjsHTML.parse peut retourner un tableau de fragments HTML; on les joint si nécessaire
      const html = Array.isArray(parsed) ? parsed.join('') : String(parsed);
      this.output_html = this.sanitizer.bypassSecurityTrustHtml(html);

      let snippet = { ...this.snippet };
      snippet.content = html; // On persiste la chaîne HTML brute, PAS l'objet SafeHtml
      this.activeModal.close(snippet);
    } catch (error) {
      console.error('Error saving snippet:', error);
      this.activeModal.close(this.snippet);
      return;
    }

  }


  htmlToEditorJsBlocks(html: string): any {
 
    const div = document.createElement('div');
    div.innerHTML = html;
    const blocks: any[] = [];
    div.childNodes.forEach(node => {
      if (node.nodeType === 1) { // Element
        const tag = (node as HTMLElement).tagName;
        if (/^H[1-6]$/.test(tag)) {
          blocks.push({
            type: 'header',
            data: {
              text: (node as HTMLElement).innerHTML,
              level: Number(tag[1])
            }
          });
        } else if (tag === 'P') {
          // Si le paragraphe ne contient qu'un lien, on le convertit en block linkTool
          const p = node as HTMLElement;
          const a = p.childNodes.length === 1 && p.firstChild && (p.firstChild as HTMLElement).tagName === 'A' ? p.firstChild as HTMLAnchorElement : null;
          if (a) {
            blocks.push({
              type: 'linkTool',
              data: {
                link: a.getAttribute('href') || '',
                meta: {},
                text: a.textContent || ''
              }
            });
          } else {
            blocks.push({
              type: 'paragraph',
              data: {
                text: p.innerHTML
              }
            });
          }
        } else if (tag === 'A') {
          // Lien isolé hors paragraphe
          blocks.push({
            type: 'linkTool',
            data: {
              link: (node as HTMLAnchorElement).getAttribute('href') || '',
              meta: {},
              text: (node as HTMLAnchorElement).textContent || ''
            }
          });
        } else if (tag === 'UL' || tag === 'OL') {
          const items: string[] = [];
          (node as HTMLElement).querySelectorAll('li').forEach(li => {
            items.push(li.innerHTML);
          });
          blocks.push({
            type: 'list',
            data: {
              style: tag === 'UL' ? 'unordered' : 'ordered',
              items
            }
          });
        } else if (tag === 'TABLE') {
          const rows: string[][] = [];
          (node as HTMLElement).querySelectorAll('tr').forEach(tr => {
            const cells: string[] = [];
            tr.querySelectorAll('td,th').forEach(cell => {
              cells.push(cell.innerHTML);
            });
            rows.push(cells);
          });
          blocks.push({
            type: 'table',
            data: {
              content: rows
            }
          });
        }
      }
    });
    return { blocks };
  }
}
