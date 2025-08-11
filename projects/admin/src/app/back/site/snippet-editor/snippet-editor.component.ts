import { AfterViewInit, Component, EventEmitter, Input, Output } from '@angular/core';
import { Snippet } from '../../../common/interfaces/snippet.interface';
import EditorJS from '@editorjs/editorjs';
import edjsHTML from 'editorjs-html'
import Header from '@editorjs/header';
import List from '@editorjs/list';

@Component({
  selector: 'app-snippet-editor',
  imports: [],
  templateUrl: './snippet-editor.component.html',
  styleUrl: './snippet-editor.component.scss'
})
export class SnippetEditorComponent implements AfterViewInit {
  @Input() snippet!: Snippet;
  @Output() snippetChange = new EventEmitter<Snippet | null>();
  editor!: EditorJS;
  edjsParser!: any;
  // initial_data!: any;
  initial_html!: any;
  output_html!: string;

  ngOnInit(): void {
    this.edjsParser = edjsHTML();
    this.initial_html = this.snippet.content;
  }

  ngAfterViewInit(): void {

    this.editor = new EditorJS(
      {
        holder: 'editorjs',
        placeholder: 'Start writing your content here...',
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

        onChange: (data) => this.onDataChanges(data),
      });

    this.editor.isReady.then(async () => {
      console.log('EditorJS is ready');
      await this.editor.blocks.renderFromHTML(this.initial_html);
    });
  }

  private onDataChanges(data: any): void {
    // console.log('current block index:', data.blocks.getCurrentBlockIndex());
    this.editor.save()
      .then(data => {
        console.log('EditorJS output data:', (data));
        this.output_html = this.edjsParser.parse(data);
      });
  }

   saveSnippet(): void {
    let snippet = { ...this.snippet };
    snippet.content = this.output_html;
    this.snippetChange.emit(snippet);
  }
}
