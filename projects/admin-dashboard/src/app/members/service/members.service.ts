import { Injectable } from '@angular/core';
import { generateClient, get } from 'aws-amplify/api';
import { BehaviorSubject, from, generate, Observable, of } from 'rxjs';
import { Schema } from '../../../../../../amplify/data/resource';
import { Member } from '../../../../../common/members/member.interface';

@Injectable({
  providedIn: 'root'
})
export class MembersService {
  private _members!: Member[];
  // private _members$: BehaviorSubject<Member[]> = new BehaviorSubject(this._members);

  constructor() {
    // this.getMembers().then((members) => {
    //   this._members = members;
    //   this._members$.next(this._members);
    // });
  }

  // get members$(): Observable<Member[]> {
  //   return this._members$ as Observable<Member[]>;
  // }

  listMembers(): Observable<Member[]> {

    const fetchMembers = async () => {
      const client = generateClient<Schema>();
      // console.log('fetching members ... 200 max');
      const { data: members, errors } = await client.models.Member.list(
        { limit: 200 }
      );
      if (errors) {
        console.error('Member.list error', errors);
        return [];
      }
      this._members = members as Member[];
      return members as Member[];
    };

    return this._members ? of(this._members) : from(fetchMembers());
  }


  getMemberbyLicense(license_number: string): Member | null {
    return this._members.find((m) => m.license_number === license_number) || null;
  }

  getMember(id: string): Member | null {
    return this._members.find((m) => m.id === id) || null;
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
      console.log('Member created', newMember);
      this._members.push(newMember as Member);
      // this._members$.next(this._members);
    }

  }

  async readMember(id: string): Promise<Member | null> {
    const client = generateClient<Schema>();
    const { data, errors } = await client.models.Member.get({ id: id });
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
        }
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
      console.log('Member updated', updatedMember.license_number);
      this._members = this._members.map((m) => m.license_number === member.license_number ? member : m);
      // this._members$.next(this._members);
    }
  }

  async deleteMember(license_number: string) {
    const client = generateClient<Schema>();
    const { data: deletedMember, errors } = await client.models.Member.delete({ id: license_number });
    if (errors) {
      console.error(errors);
      return;
    }
    if (!deletedMember) {
      console.error('Member not deleted');
      return;
    } else {
      this._members = this._members.filter((m) => m.license_number !== deletedMember.license_number);
      // this._members$.next(this._members);
    }
  }


}