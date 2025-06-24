import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FileService } from '../../../../../common/services/files.service';
import { S3Item } from '../../../../../common/file.interface';
import { ReplacePipe } from '../../../../../common/pipes/replace.pipe';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-get-album',
  standalone: true,
  imports: [CommonModule, ReplacePipe, FormsModule, ReactiveFormsModule],
  templateUrl: './get-album.component.html',
  styleUrl: './get-album.component.scss'
})
export class GetAlbumComponent {
  @Input() folders!: Set<string>;
  selected_folder: string = '';

  constructor(
    private activeModal: NgbActiveModal,
    private fileService: FileService


  ) { }



  got_it() {

    this.activeModal.close(this.selected_folder);
  }
  close() {
    this.activeModal.close(null);
  }
}
