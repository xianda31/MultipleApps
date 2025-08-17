import { AfterViewInit, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Snippet } from '../../../common/interfaces/snippet.interface';
import EditorJS from '@editorjs/editorjs';
import edjsHTML from 'editorjs-html'
import Header from '@editorjs/header';
import List from '@editorjs/list';
import { CommonModule } from '@angular/common';


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
  edjsParser = edjsHTML();
  output_html!: string;

  constructor(
    private activeModal: NgbActiveModal,
  ) { }


  ngAfterViewInit(): void {

    const initialData = this.htmlToEditorJsBlocks(this.snippet.content);     // Convertit le HTML initial en blocks EditorJS
    console.log('Snippet Content:', this.snippet.content);
    console.log('Initial Data:', initialData);

    this.editor = new EditorJS(
      {
        holder: 'editorjs',
        placeholder: 'Ecrire votre texte ici...',
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
      this.output_html = this.edjsParser.parse(data); // Convertit les blocks EditorJS en HTML
      let snippet = { ...this.snippet };
      snippet.content = this.output_html;
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
          blocks.push({
            type: 'paragraph',
            data: {
              text: (node as HTMLElement).innerHTML
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
        }
      }
    });
    return { blocks };
  }
}
