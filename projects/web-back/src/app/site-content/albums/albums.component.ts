import { Component } from '@angular/core';
import { FileService } from '../../../../../common/services/files.service';
import { S3Item } from '../../../../../common/file.interface';
import { ImgUploadComponent } from '../files/img-upload/img-upload.component';
import { ReplacePipe } from '../../../../../common/pipes/replace.pipe';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-albums',
  standalone: true,
  imports: [ImgUploadComponent, ReplacePipe, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './albums.component.html',
  styleUrl: './albums.component.scss'
})
export class AlbumsComponent {
  album_name: string = '';
  S3Items: S3Item[] = [];
  filteredItems: S3Item[] = [];
  folders: Set<string> = new Set();

  new_album: FormControl = new FormControl(null, Validators.pattern('^[a-zA-Z0-9_]*$'));

  get new_album_valid() {
    return this.new_album.valid;
  }

  constructor(
    private fileService: FileService
  ) { }

  ngOnInit(): void {
    this.listAlbums();
  }

  listAlbums() {
    this.S3Items = [];
    this.fileService.list('albums/').then((data) => {
      data.forEach((item) => {
        if (item.size) {
          this.S3Items.push(item);
          let possibleFolder = item.path.split('/').slice(0, -1).join('/');
          if (possibleFolder) this.folders.add(possibleFolder);
        } else {
          this.folders.add(item.path);
        }
      });
      this.S3Items.forEach((item) => item.url = this.fileService.getPresignedUrl(item.path));
      this.filteredItems = this.S3Items.filter((item) => item.path.startsWith(this.currentDirectory()));
    });
  }

  currentDirectory() {
    return "albums/" + this.album_name + "/";
  }

  newFolder() {
    this.album_name = this.new_album.value;
  }

  onSelectFolder(folder: string) {
    this.album_name = folder.split('/').pop() || '';
    this.filteredItems = this.S3Items.filter((item) => item.path.startsWith(this.currentDirectory()));
  }

  onDelete(item: S3Item) {
    this.fileService.delete(item.path);
    this.filteredItems = this.filteredItems.filter((i) => i.path !== item.path);
  }

  addItem(event: any) {
    this.listAlbums();
  }
}
