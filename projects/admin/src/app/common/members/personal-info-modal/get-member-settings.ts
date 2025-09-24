import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { Member, Member_settings } from '../../interfaces/member.interface';
import { FileService, S3_ROOT_FOLDERS } from '../../services/files.service';
import { of } from 'rxjs';
import { MembersService } from '../../services/members.service';
import { ImageService } from '../../services/image.service';
import { ToastService } from '../../services/toast.service';
import { MemberSettingsService } from '../../services/member-settings.service';


@Component({
  selector: 'app-get-member-settings',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModalModule],

  templateUrl: './get-member-settings.html',
  styleUrls: ['./get-member-settings.scss']
})
export class GetMemberSettingsComponent {
  @Input() readonly member!: Member;
  preferenceForm !: FormGroup;
  preference!: Member_settings;
  base64_ico: string = '';
  full_name: string = '';

  readonly default_ico = 'anybody.png';
  readonly avatar_path = S3_ROOT_FOLDERS.PORTRAITS + '/';

  constructor(
    private activeModal: NgbActiveModal,
    private formbuilder: FormBuilder,
    private fileService: FileService,
    private imageService: ImageService,
    private toastService: ToastService,
    private memberSettingsService: MemberSettingsService,
    private membersService: MembersService

  ) {

    this.preferenceForm = this.formbuilder.group({
      ico_url$: [of(this.default_ico)],
      has_avatar: [false],
      accept_mailing: [true],
    });
  }

  ngOnInit(): void {

    this.full_name = this.membersService.full_name(this.member);

    this.preferenceForm.patchValue({
      ico_url$: this.memberSettingsService.getAvatarUrl(this.member),
      accept_mailing: this.member.accept_mailing ?? true,
      has_avatar: this.member.has_avatar ?? false
    });
  };

  get has_avatar() {
    return this.preferenceForm.get('has_avatar')?.value;
  }
  get ico_url$() {
    return this.preferenceForm.get('ico_url$')?.value;
  }

  save() {
    let new_preference: Member_settings = {
      has_avatar: this.preferenceForm.value.has_avatar,
      accept_mailing: this.preferenceForm.value.accept_mailing,
    };
    if (this.base64_ico) {
      this.upload_avatar_file();
    }
    this.activeModal.close(new_preference);
  }

  exit() {
    this.activeModal.close(null);
  }

  changeIco(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
          // Resize and convert to base64
          this.base64_ico = this.resize_to_avatar(img, 64);
          this.preferenceForm.patchValue({ ico_url$: of(this.base64_ico) });
          this.preferenceForm.patchValue({ has_avatar: true });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  resetIco() {
    this.base64_ico = '';
    this.delete_avatar_file();
    this.preferenceForm.patchValue({
      has_avatar: false
    });

  }

  private resize_to_avatar(img: HTMLImageElement, side: number): string {
    // 1. Crop to square
    const width = img.width;
    const height = img.height;
    let sx = 0, sy = 0, s = 0;
    if (width >= height) {
      // Paysage : crop centré
      s = height;
      sx = (width - height) / 2;
      sy = 0;
    } else {
      // Portrait : crop carré à partir de (height-side)/4
      s = width;
      sx = 0;
      sy = Math.max(0, (height - side) / 4);
    }

    // 2. Resize to side x side
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

  // 3. Coller sur fond transparent
  ctx.clearRect(0, 0, side, side);

  // 4. Dessiner l'image recadrée et redimensionnée (carré)
  ctx.drawImage(img, sx, sy, s, s, 0, 0, side, side);

  // 5. Retourner en base64 PNG (transparence)
  return canvas.toDataURL('image/png', 0.95);
  }

  async delete_avatar_file() {
    const ico_file_name = this.full_name + '.png';
    await this.fileService.delete_file(this.avatar_path + ico_file_name).then(() => {
      this.toastService.showSuccess(` préférences de ${this.full_name}`, 'Photo supprimée');
    });
  }

  async upload_avatar_file() {
    const ico_blob = this.imageService.base64ToBlob(this.base64_ico);
    const ico_file = new File([ico_blob], `${this.full_name}.png`, { type: 'image/png' });
    await this.fileService.upload_file(ico_file, 'portraits/').then(() => {
      this.toastService.showSuccess(` préférences de ${this.full_name}`, 'Photo mise à jour');
    });
  }
}
