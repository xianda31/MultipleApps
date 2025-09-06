import { Component, forwardRef, Input, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { FileSystemNode, getChildNodes, isFolder, S3Item } from '../../../common/interfaces/file.interface';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-input-file',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputFileComponent),
      multi: true
    }
  ],
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './input-file.component.html',
  styleUrl: './input-file.component.scss'
})
export class InputFileComponent implements ControlValueAccessor {
  @Input() fileSystemNode !: FileSystemNode;
  input!: string;
  placeholder: string = 'Sélectionner un fichier';
  disabled = false;

  current_node_childs = signal<FileSystemNode | null>(null);
  node_stack: FileSystemNode[] = [];
  returned_value: any;

  onChange: (value: S3Item | null) => void = () => { };
  onTouch: () => void = () => { };

  constructor() { }
  ngOnInit(): void {
    if (!this.fileSystemNode) return;
    this.open_node(this.fileSystemNode);
    this.node_stack.push(this.fileSystemNode);
    console.log('initial stack:', this.node_stack);
    this.placeholder = 'Sélectionner un fichier dans ' + Object.keys(this.fileSystemNode)[0];
  }

  writeValue(input: S3Item | null): void {
    this.input = (input === undefined || input === null) ? '' : input.path;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouch = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  setValue(key: string) {
    this.onTouch();
    console.log('setValue', key)
    if (this.current_node_childs() === null) return;

    // search input in current_node_childs
    const childs = this.current_node_childs() as FileSystemNode;
    const found = childs[key]?.['__data'] as unknown as S3Item;
    // console.log('found', found)
    if (found.size > 0) {
      // is a file
      this.input = key;
      this.returned_value = found;
      this.onChange(found);
    } else {
      // not a file
      const node: FileSystemNode = { [key]: childs[key] };
      this.input = '';
      this.placeholder = 'Sélectionner un fichier dans ' + found.path;
      this.push_node(key, childs[key]);
      // this.open_node(node);
    }
  }

  // filesystem utilities

  // select_node(node: FileSystemNode) {
  //   console.log('selected', node)
  // }


  open_node(node: FileSystemNode): void {
    const childs: FileSystemNode | null = getChildNodes(node);
    this.current_node_childs.set(childs)
  }

  push_node(key: string, value: FileSystemNode | { __data: S3Item }) {
    // regenerate FileSystemNode from html (loop on current_node_childs() | keyvalue)
    const node: FileSystemNode = { [key]: value };
    this.open_node(node)
    // if (isFolder(node)) { 
    this.node_stack.push(node);
    // console.log('Pushing node, new current:', node);
    // }
  }

  pop_node() {
    if (this.node_stack.length > 1) {
      this.node_stack.pop();
      const prevNode = this.node_stack[this.node_stack.length - 1];
      this.open_node(prevNode);
      this.input = '';
      this.placeholder = 'Sélectionner un fichier dans ' + Object.keys(prevNode)[0];
    }
  }

  get_icon(node: any): string {
    return node['__data'] && node['__data'].size > 0 ? 'bi bi-file' : 'bi bi-folder';
  }

  get_button_class(node: any): string {
    return node['__data'] && node['__data'].size > 0 ? 'btn btn-outline-primary' : 'btn btn-outline-secondary';
  }
}
