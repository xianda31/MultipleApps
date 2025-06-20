import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { BehaviorSubject, Observable, tap, switchMap } from 'rxjs';
import { Schema } from '../../../../../../amplify/data/resource';
import { Member } from '../../../../../common/member.interface';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { DBhandler } from '../../../../../cashier/src/app/graphQL.service';

@Injectable({
  providedIn: 'root'
})
export class MembersService {
  private _members!: Member[];
  private _members$: BehaviorSubject<Member[]> = new BehaviorSubject(this._members);

  constructor(
    private toastService: ToastService,
    private dbHandler: DBhandler
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

  last_then_first_name(member: Member): string {
    return `${member.lastname} ${member.firstname}`;
  }
  first_then_last_name(member: Member): string {
    return `${member.firstname} ${member.lastname}`;
  }

  async createMember(member: Member) {
    const client = generateClient<Schema>();
    let { id, ...memberCreateInput } = member;
    const { data: newMember, errors } = await client.models.Member.create(memberCreateInput);
    if (errors) {
      console.error(errors);
      return;
    }
    if (!newMember) {
      console.error('Member not created');
      return;
    } else {
      this.toastService.showSuccessToast('Membre créé', `${newMember.lastname} ${newMember.firstname}`);
      // console.log('Member created', newMember);
      this._members.push(newMember as Member);
      this._members$.next(this._members);
    }

  }

  async readMember(id: string): Promise<Member | null> {
    const client = generateClient<Schema>();
    const { data, errors } = await client.models.Member.get({ id: id }, { authMode: 'userPool' }); // use identity pool to allow unauthenticated access
    if (errors) {
      console.error(errors);
      return null;
    }
    return data as Member;
  }

  async getMemberByEmail(email: string): Promise<Member | null> {
    let promise = new Promise<Member | null>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data, errors } = await client.models.Member.list({
        filter: {
          email: { eq: email }
        },
        authMode: 'identityPool' // use identity pool to allow unauthenticated access
      });
      if (errors) {
        console.error(errors);
        reject(null);
      }
      resolve(data[0] as Member);   // array of only one element, hopefully !!!
    });
    return promise;
  }

  async searchMemberByLicense(license_number: string): Promise<Member | null> {
    let promise = new Promise<Member | null>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data, errors } = await client.models.Member.list({
        filter: {
          license_number: { eq: license_number }
        },
        authMode: 'identityPool' // use identity pool to allow unauthenticated access
      });
      if (errors) {
        console.error(errors);
        reject(null);
      }
      resolve(data[0] as Member);   // array of only one element, hopefully !!!
    });
    return promise;
  }

  async updateMember(member: Member) {
    const client = generateClient<Schema>();
    const { data: updatedMember, errors } = await client.models.Member.update(member);
    if (errors) {
      console.error(errors);
      return;
    }
    if (!updatedMember) {
      console.error('Member not updated');
      return;
    } else {
      // console.log('Member updated', updatedMember.lastname);
      this._members = this._members.map((m) => m.license_number === member.license_number ? member : m);
      this._members$.next(this._members);
    }
  }

  async deleteMember(member: Member) {

    try {
      let done = await this.dbHandler.deleteMember(member.id)
      if (done) {
        this._members = this._members.filter((m) => m.id !== member.id);
        this._members$.next(this._members);
        this.toastService.showSuccessToast('Service adhérent', `${member.lastname} ${member.firstname} supprimé`);
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      this.toastService.showErrorToast('Service adhérent', 'Erreur de suppression');
    }
  }
}

