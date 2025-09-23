import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap, switchMap, of } from 'rxjs';
import { Member } from '../interfaces/member.interface';
import { ToastService } from '../services/toast.service';
import { DBhandler } from './graphQL.service';
import { FileService, S3_ROOT_FOLDERS } from './files.service';

@Injectable({
  providedIn: 'root'
})
export class MembersService {
  private _members!: Member[];
  private _members$: BehaviorSubject<Member[]> = new BehaviorSubject(this._members);

  constructor(
    private toastService: ToastService,
    private dbHandler: DBhandler,
    private fileService: FileService
  ) { }


  listMembers(): Observable<Member[]> {
    let remote_load$ = this.dbHandler.listMembers().pipe(
      tap((members) => {
        this._members = members;
        this._members = this._members.sort((a, b) => a.lastname.localeCompare(b.lastname))
        this._members$.next(this._members);
      }),
      switchMap(() => this._members$.asObservable())
    )
    return this._members ? this._members$.asObservable() : remote_load$;
  }


  getMemberbyLicense(license_number: string): Member | null {
    return this._members.find((m) => m.license_number === license_number) || null;
  }

  getMemberbyName(name: string): Member | null {
    return this._members.find((m) => m.lastname + ' ' + m.firstname === name) || null;
  }

  getMember(id: string): Member | null {
    return this._members.find((m) => m.id === id) || null;
  }

  full_name(member: Member): string {
    return this.last_then_first_name(member);
  }

  last_then_first_name(member: Member): string {
    return `${member.lastname} ${member.firstname}`;
  }
  first_then_last_name(member: Member): string {
    return `${member.firstname} ${member.lastname}`;
  }

  async createMember(member: Member) {
    const { createdAt, updatedAt, id, ...member_input } = member;
    try {
      const newMember = await this.dbHandler.createMember(member_input);
      this.toastService.showSuccess('Membre créé', `${newMember.lastname} ${newMember.firstname}`);
      this._members.push(newMember as Member);
      this._members = this._members.sort((a, b) => a.lastname.localeCompare(b.lastname))
      this._members$.next(this._members);
    }
    catch (errors) {
      if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
        if ((errors[0] as any).errorType === 'Unauthorized') {
          this.toastService.showErrorToast('Gestion des membres', 'Vous n\'êtes pas autorisé à modifier une fiche adhérent');
          return Promise.reject('Unauthorized');
        }
      }
      this.toastService.showErrorToast('Gestion des membres', 'Une erreur est survenue lors de la modification de la fiche adhérent');
      return Promise.reject('Error updating member');

    }

  }

  async readMember(id: string): Promise<Member | null> {
    try {
      let member = await this.dbHandler.readMember(id);
      // if (member) {
      //   this._members = this._members.map((m) => m.id === id ? member : m);
      //   this._members$.next(this._members);
      // }
      return member;
    }
    catch (error) {
      console.error('Error reading member:', error);
      this.toastService.showErrorToast('Service adhérent', 'impossible de lire la fiche adhérent');
      return null;
    }

  }

  async searchMemberByEmail(email: string): Promise<Member | null> {
    return this.dbHandler.searchMemberByEmail(email);
  }

  async searchMemberByLicense(license_number: string): Promise<Member | null> {
    return this.dbHandler.searchMemberByLicense(license_number)
  }

  async updateMember(member: Member) {
    try {
      const newMember = await this.dbHandler.updateMember(member);
      this.toastService.showSuccess('Membre mis à jour', `${newMember.lastname} ${newMember.firstname}`);
      if (this._members) {      // could be not loaded yet
        this._members = this._members.map((m) => m.id === newMember.id ? newMember : m);
        this._members = this._members.sort((a, b) => a.lastname.localeCompare(b.lastname))
        this._members$.next(this._members);
      }
    }
    catch (errors) {
      if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
        if ((errors[0] as any).errorType === 'Unauthorized') {
          this.toastService.showErrorToast('Gestion des membres', 'Vous n\'êtes pas autorisé à modifier une fiche adhérent');
          return Promise.reject('Unauthorized');
        }
      }
      this.toastService.showErrorToast('Gestion des membres', 'Une erreur est survenue lors de la modification de la fiche adhérent');
      return Promise.reject('Error updating member');
    }
  }

  async deleteMember(member: Member) {

    try {
      let done = await this.dbHandler.deleteMember(member.id)
      if (done) {
        this._members = this._members.filter((m) => m.id !== member.id);
        this._members$.next(this._members);
        this.toastService.showSuccess('Service adhérent', `${member.lastname} ${member.firstname} supprimé`);
      }
    }
    catch (errors) {
      if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
        if ((errors[0] as any).errorType === 'Unauthorized') {
          this.toastService.showErrorToast('Gestion des membres', 'Vous n\'êtes pas autorisé à supprimer une fiche adhérent');
          return Promise.reject('Unauthorized');
        }
      }
      this.toastService.showErrorToast('Gestion des membres', 'Une erreur est survenue lors de la suppression de la fiche adhérent');
      return Promise.reject('Error deleting member');
    }
  }


}