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

  current_node_childs = signal<FileSystemNode | null>(null);
  node_stack: FileSystemNode[] = [];
  returned_value: any;

  onChange: (value: string | null) => void = () => {
  };
  onTouch: () => void = () => { };
  disabled = false;

  constructor() { }
  ngOnInit(): void {
    if (!this.fileSystemNode) return;
    this.open_node(this.fileSystemNode);
    this.node_stack.push(this.fileSystemNode);
  }

  writeValue(input: S3Item | null): void {
    if (input === undefined || input === null) {
      this.input = '';
      return;
    }

    this.input = input.path;
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

  setValue(key:string) {
    this.onTouch();
    console.log('setValue', key)
    if (this.current_node_childs() === null) return;
    
    // search input in current_node_childs
    const childs = this.current_node_childs() as FileSystemNode;
    const found = childs[key]?.['__data'] as unknown as S3Item;
    console.log('found', found)
    if (found && found.size > 0) {
      this.input = found.path;
      this.returned_value = found;
      this.onChange(found.path);
    } else {
      // not a file
      const node: FileSystemNode = { [key]: childs[key] };

      console.log('not a file, open it', node)
      this.open_node(node);
    }
    // this.onChange(found);
  }

  // filesystem utilities

  select_node(node: FileSystemNode) {
    console.log('selected', node)
  }


  open_node(node: FileSystemNode): void {
    const childs: FileSystemNode | null = getChildNodes(node);
    this.current_node_childs.set(childs)
  }

  push_node(key: string, value: FileSystemNode | { __data: S3Item }) {
    // regenerate FileSystemNode from html (loop on current_node_childs() | keyvalue)
    const node: FileSystemNode = { [key]: value };
    this.open_node(node)
    if (isFolder(node)) this.node_stack.push(node);
  }

  pop_node() {
    this.node_stack.pop();
    const parent = this.node_stack[this.node_stack.length - 1];
    if (parent === null) return;
    console.log('Popping node, new current:', parent);
    this.open_node(parent);
  }

  get_icon(node: any): string {
    return node['__data'] && node['__data'].size > 0 ? 'bi bi-file' : 'bi bi-folder';
  }

  get_button_class(node: any): string {
    return node['__data'] && node['__data'].size > 0 ? 'btn btn-outline-primary' : 'btn btn-outline-secondary';
  }
}
