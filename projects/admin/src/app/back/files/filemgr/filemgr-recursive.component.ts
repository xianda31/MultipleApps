import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileSystemNode, S3Item } from '../../../common/interfaces/file.interface';

@Component({
  selector: 'app-filemgr-recursive',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filemgr-recursive.component.html',
  // styleUrls: ['./filemgr-recursive.component.scss']
})
export class FilemgrRecursiveComponent {
  @Input() fileSystemNode!: FileSystemNode | null;
  @Input() currentNode!: FileSystemNode;
  @Input() nodeStack!: FileSystemNode[];
  @Input() selectedItem!: S3Item | null;
}
