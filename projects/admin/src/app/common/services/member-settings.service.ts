import { Injectable } from '@angular/core';
import { Member } from '../interfaces/member.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetMemberSettingsComponent } from '../members/personal-info-modal/get-member-settings';
import { MembersService } from './members.service';
import { ToastService } from './toast.service';
import { BehaviorSubject, Observable, of, catchError, map, shareReplay, switchMap } from 'rxjs';
import { FileService, S3_ROOT_FOLDERS } from './files.service';

@Injectable({
  providedIn: 'root'
})
export class MemberSettingsService {

  private settings_change$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  private avatarPaths$?: Observable<Set<string>>;

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

    return this.getAvatarPaths$().pipe(
      switchMap((avatarPaths) => avatarPaths.has(avatar_file)
        ? this.fileService.getPresignedUrl$(avatar_file, true, false)
        : of('')),
      catchError(() => of(''))
    );
  }

  private getAvatarPaths$(): Observable<Set<string>> {
    if (!this.avatarPaths$) {
      this.avatarPaths$ = this.fileService.list_files(S3_ROOT_FOLDERS.PORTRAITS + '/').pipe(
        map((files) => new Set(files.map((file) => file.path))),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }

    return this.avatarPaths$;
  }

  set_settingsChange() {
    this.avatarPaths$ = undefined;
    this.settings_change$.next(this.settings_change$.getValue() + 1);
  }

  settingsChange$(): Observable<number> {
    return this.settings_change$.asObservable();
  }

  access_settings(member: Member): Observable<boolean> {
    return new Observable<boolean>(observer => {
      const modalRef = this.modalService.open(GetMemberSettingsComponent, { centered: true, size: 'lg', backdrop: 'static', keyboard: false });
      modalRef.componentInstance.member = member;

      modalRef.result.then((settings) => {
        if (settings) {
          // Les settings retournés contiennent les nouvelles valeurs
          const settings_changed = (settings.accept_mailing !== member.accept_mailing) ||
            (settings.city !== member.city) ||
            (settings.email !== member.email) ||
            (settings.phone_one !== member.phone_one);

          console.log('Settings returned from modal:', settings);
          console.log('Current member settings:', { accept_mailing: member.accept_mailing, city: member.city, email: member.email, phone_one: member.phone_one });
          console.log('Settings changed?', settings_changed);

          if (settings_changed) {
            member.accept_mailing = settings.accept_mailing;
            member.city = settings.city;
            member.email = settings.email;
            member.phone_one = settings.phone_one;
            this.set_settingsChange();
            this.membersService.updateMember(member).then(() => {
              this.toastService.showSuccess(` préférences de ${this.membersService.full_name(member)}`, 'Mise à jour effectuée');
              observer.next(true);
              observer.complete();
            }).catch((error) => {
              console.error('Error updating member:', error);
              this.toastService.showError('Erreur', 'Impossible de sauvegarder les préférences');
              observer.next(false);
              observer.complete();
            });
          } else {
            console.log('No changes detected, not updating');
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
