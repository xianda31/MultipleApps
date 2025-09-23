import { Injectable } from '@angular/core';
import { Member } from '../interfaces/member.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetMemberSettingsComponent } from '../members/personal-info-modal/get-member-settings';
import { MembersService } from './members.service';
import { ToastService } from './toast.service';
import { BehaviorSubject,  Observable, of } from 'rxjs';
import { FileService, S3_ROOT_FOLDERS } from './files.service';

@Injectable({
  providedIn: 'root'
})
export class MemberSettingsService {

private settings_change$: BehaviorSubject<number> = new BehaviorSubject<number>(0);

  constructor(
    private modalService: NgbModal,
    private membersService: MembersService,
    private toastService: ToastService,
    private fileService: FileService

  ) { }

// getAvatarUrl(member: Member) {
//   this._avatar$.next(this._getAvatarUrl(member));
//   return this._avatar$.asObservable();
// }

  // utilities functions (once members are loaded)

  getAvatarUrl(member: Member): Observable<string> {
    const avatar_path = S3_ROOT_FOLDERS.PORTRAITS + '/';
    const avatar_file = avatar_path + this.membersService.full_name(member) + '.png';

    return member.has_avatar ? this.fileService.getPresignedUrl$(avatar_file) : of('')
  }

  set_settingsChange() {
    this.settings_change$.next(this.settings_change$.getValue() + 1);
  }

  settingsChange$(): Observable<number> {
    return this.settings_change$.asObservable();
  }

  access_settings(member: Member): Observable<boolean> {
    return new Observable<boolean>(observer => {
      const modalRef = this.modalService.open(GetMemberSettingsComponent, { centered: true, size: 'sm', backdrop: 'static', keyboard: false });
      modalRef.componentInstance.member = member;

      modalRef.result.then((settings) => {
        let settings_changed = false;
        if (settings) {
          settings_changed = (settings.has_avatar !== member.has_avatar) ||
            (settings.accept_mailing !== member.accept_mailing);

          if (settings_changed) {
            member.has_avatar = settings.has_avatar;
            member.accept_mailing = settings.accept_mailing;
            this.set_settingsChange();
            this.membersService.updateMember(member).then(() => {
              this.toastService.showSuccess(` préférences de ${this.membersService.full_name(member)}`, 'Mise à jour effectuée');
              observer.next(true);
              observer.complete();
            });
          } else {
            observer.next(false);
            observer.complete();
          }
        } else {
          observer.next(false);
          observer.complete();
        }
      }).catch(() => {
        observer.next(false);
        observer.complete();
      });
    });
  }
}
