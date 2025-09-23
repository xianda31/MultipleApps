import { Injectable } from '@angular/core';
import { Member } from '../interfaces/member.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetMemberSettingsComponent } from '../members/personal-info/get-member-settings';
import { FileService } from './files.service';
import { MembersService } from './members.service';
import { ToastService } from './toast.service';
import { ImageService } from './image.service';

@Injectable({
  providedIn: 'root'
})
export class MemberSettingsService {

  constructor(
    private modalService: NgbModal,
    private membersService: MembersService,
    private toastService: ToastService

  ) { }

  access_settings(member: Member) {
    const modalRef = this.modalService.open(GetMemberSettingsComponent, { centered: true, size: 'sm', backdrop: 'static', keyboard: false });
    modalRef.componentInstance.member = member;

    modalRef.result.then((settings) => {
      
      
      if (settings) {
        // si les paramètres ont changé
        let settings_changed = (settings.has_avatar !== member.has_avatar) ||
          (settings.accept_mailing !== member.accept_mailing);

        if (settings_changed) {
         
          member.has_avatar = settings.has_avatar;
          member.accept_mailing = settings.accept_mailing;

          this.membersService.updateMember(member).then(() => {
            this.toastService.showSuccess(` préférences de ${this.membersService.full_name(member)}`, 'Mise à jour effectuée');
          });
        }


      }
    });
  }
}
