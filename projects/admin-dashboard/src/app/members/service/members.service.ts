import { Injectable } from '@angular/core';
import { generateClient, get } from 'aws-amplify/api';
import { BehaviorSubject, generate, Observable } from 'rxjs';
import { Schema } from '../../../../../../amplify/data/resource';
import { Member } from '../../../../../common/members/member.interface';

@Injectable({
  providedIn: 'root'
})
export class MembersService {
  private _members: Member[] = [];
  private _members$: BehaviorSubject<Member[]> = new BehaviorSubject(this._members);
  private call: number = 1;

  constructor() {
    this.getMembers().then((members) => {
      this._members = members;
      this._members$.next(this._members);
    });
  }

  get members$(): Observable<Member[]> {
    return this._members$ as Observable<Member[]>;
  }

  private getMembers(): Promise<Member[]> {
    const client = generateClient<Schema>();

    const fetchMembers = async () => {
      const { data: members, errors } = await client.models.Member.list();
      if (errors) {
        console.error(errors);
        return [];
      }
      return members as Member[];
    };
    // console.log('MembersService.getMembers call #', this.call++);
    return fetchMembers();
  }


  isMember(license_number: string): boolean {
    return this._members.some((m) => m.license_number === license_number);
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
      // console.log('Member created', newMember);
      this._members.push(newMember as Member);
      this._members$.next(this._members);
    }

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
      this._members$.next(this._members);
    }
  }


}