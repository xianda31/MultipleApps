import { Component, Input, Output, EventEmitter, OnInit, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileService } from '../../../common/services/files.service';

@Component({
  selector: 'app-file-system-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-system-selector.component.html',
  styleUrls: ['./file-system-selector.component.scss']
})
export class FileSystemSelectorComponent implements OnInit {
  @Input() rootFolder: string | null = null; // e.g. 'images/'
  @Input() mode: 'files' | 'folders' | 'both' = 'files';
  @Input() items: any[] | null = null;
  @Input() tree: any = null;
  @Output() select = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  expanded = new Set<string>();

  constructor(private fileService: FileService, private el: ElementRef, private renderer: Renderer2) {}

  ngOnInit(): void {
    try {
      const isInModal = !!this.el.nativeElement.closest('.modal') || !!this.el.nativeElement.closest('.modal-content');
      if (isInModal) this.renderer.addClass(this.el.nativeElement, 'in-modal');
      else this.renderer.addClass(this.el.nativeElement, 'not-in-modal');
    } catch (e) {}

    if ((!this.items || !this.tree) && this.rootFolder) {
      this.fileService.list_files(this.rootFolder).subscribe((items) => {
        this.items = items;
        this.tree = this.fileService.generate_filesystem(items);
      });
    }
  }

  nodeKeys(node: any) { return node ? Object.keys(node).filter(k => k !== '__data') : []; }

  isFolder(node: any, key: string) {
    const child = node && node[key];
    if (!child) return false;
    const childKeys = this.nodeKeys(child);
    if (childKeys.length > 0) return true;
    if (child.__data && child.__data.path && child.__data.size === 0) return true;
    return false;
  }

  toggleExpanded(path: string) { if (this.expanded.has(path)) this.expanded.delete(path); else this.expanded.add(path); }
  isExpanded(path: string) { return this.expanded.has(path); }

  getItemByPath(path: string) { return this.items ? this.items.find(it => it.path === path) : null; }

  onSelect(path: string) { this.select.emit(path); }
  onClose() { this.close.emit(); }
}
