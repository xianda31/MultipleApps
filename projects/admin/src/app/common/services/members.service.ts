import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap, switchMap, of, map } from 'rxjs';
import { Member } from '../interfaces/member.interface';
import { ToastService } from '../services/toast.service';
import { DBhandler } from './graphQL.service';
import { ClubMember } from '../ffb/interface/club-member.interface';

export enum MemberStatus {
  ADHERENT = 'ADHERENT',
  CLUB_LICENSEE = 'CLUB_LICENSEE',
  SYMPATHISANT = 'SYMPATHISANT',
  NO_LICENSE = 'NO_LICENSE',
  NON_ADHERENT = 'NON_ADHERENT',
}

export type MemberStatusCounters = {
  clubLicensees: number;
  sympathisants: number;
  ffbAdherents: number;
  noLicense: number;
  nonAdherents: number;
};

export type FfbBaseReferences = ReadonlySet<number | string>;

type MemberOperation = {
  member?: string;
  values: { [key: string]: number };
};

@Injectable({
  providedIn: 'root'
})
export class MembersService {
  private readonly CLUB_LICENSE_NAME = 'Bridge Club de Saint Orens';
  private readonly LICENSED_STATUSES = ['duly_registered', 'promoted_only'];
  private _members!: Member[];
  private _members$: BehaviorSubject<Member[]> = new BehaviorSubject(this._members);

  constructor(
    private toastService: ToastService,
    private dbHandler: DBhandler  ) { }


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

  getMember(id: string): Member {
    const found = this._members.find((m) => m.id === id);
    if (found) return found;
    console.warn(`MembersService.getMember: member with id ${id} not found in cache`);
    // return a placeholder Member to satisfy callers by construction
    return {
      id,
      gender: 'U',
      firstname: '',
      lastname: '',
      license_number: '',
      birthdate: '',
      city: '',
      season: '',
      email: '',
      phone_one: '',
      is_sympathisant: false,
      license_status: '',
      license_taken_at: '',
      membership_date: '',
      has_avatar: false,
      accept_mailing: false
    } as Member;
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
      // Initialize cache if empty
      if (!this._members) {
        this._members = [];
      }
      this._members.push(newMember as Member);
      this._members = this._members.sort((a, b) => a.lastname.localeCompare(b.lastname))
      this._members$.next(this._members);
    }
    catch (errors) {
      if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
        if ((errors[0] as any).errorType === 'Unauthorized') {
          this.toastService.showError('Gestion des membres', 'Vous n\'êtes pas autorisé à modifier une fiche adhérent');
          return Promise.reject('Unauthorized');
        }
      }
      this.toastService.showError('Gestion des membres', 'Une erreur est survenue lors de la modification de la fiche adhérent');
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
      this.toastService.showError('Service adhérent', 'impossible de lire la fiche adhérent');
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
          this.toastService.showError('Gestion des membres', 'Vous n\'êtes pas autorisé à modifier une fiche adhérent');
          return Promise.reject('Unauthorized');
        }
      }
      this.toastService.showError('Gestion des membres', 'Une erreur est survenue lors de la modification de la fiche adhérent');
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
          this.toastService.showError('Gestion des membres', 'Vous n\'êtes pas autorisé à supprimer une fiche adhérent');
          return Promise.reject('Unauthorized');
        }
      }
      this.toastService.showError('Gestion des membres', 'Une erreur est survenue lors de la suppression de la fiche adhérent');
      return Promise.reject('Error deleting member');
    }
  }

// utilities

get_birthdays_this_month(): Observable<Member[]> {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    return this.listMembers().pipe(
        map(members => members.filter(m => {
            if (m.birthdate) {
                const birthMonth = new Date(m.birthdate).getMonth() + 1;
                return birthMonth === currentMonth;
            }
            return false;
        }))
    );
  }
  get_birthdays_this_next_days(days_ahead: number): Observable<{ [key: string]: Member[]; }> {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return this.listMembers().pipe(
      map(members => members.filter(m => {
        if (m.birthdate) {
          // Extract only YYYY-MM-DD to avoid timezone conversion issues
          const dateOnly = m.birthdate.split('T')[0]; // "1958-12-02"
          const [year, month, day] = dateOnly.split('-').map(Number);
          
          // Calculate day difference from today
          const birthdayDate = new Date(currentYear, month - 1, day);
          const todayDate = new Date(currentYear, currentMonth, currentDay);
          const daysDiff = Math.floor((birthdayDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return daysDiff >= 0 && daysDiff <= days_ahead;
        }
        return false;
      })),
      map(filteredMembers => {
        const grouped: { [key: string]: Member[] } = {};
        filteredMembers.forEach(member => {
          const dateOnly = member.birthdate.split('T')[0];
          const [year, month, day] = dateOnly.split('-').map(Number);
          // Use format MM-DD for grouping
          const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(member);
        });
        return grouped;
      })
    );
  }

  /**
   * Convert IV (Index Value) to readable classification string
   * Symbols: ♠ (Pique), ♥ (Cœur), ♦ (Carreau), ♣ (Trèfle)
   * Examples: NVL (Nouveau Licencié), 4♣, 3♥, 2SA (Promotion), 1♠, 1N (Nationale)
   */
  iv_code(iv: number): string {
    // Define IV thresholds and their classifications
    const ivMap: { [key: number]: string } = {
      0: 'NC',      // Non classé
      20: 'NVL',    // Nouveau Licencié
      22: '4♣',     // 4ème série Trèfle
      24: '4♦',     // 4ème série Carreau
      26: '4♥',     // 4ème série Cœur
      28: '4♠',     // 4ème série Pique
      30: '4SA',    // 4ème série Promotion
      32: '3♣',     // 3ème série Trèfle
      34: '3♦',     // 3ème série Carreau
      36: '3♥',     // 3ème série Cœur
      38: '3♠',     // 3ème série Pique
      40: '3SA',    // 3ème série Promotion
      44: '2♣',     // 2ème série Trèfle
      48: '2♦',     // 2ème série Carreau
      52: '2♥',     // 2ème série Cœur
      56: '2♠',     // 2ème série Pique
      60: '2SA',    // 2ème série Promotion
      68: '1♣',     // 1ère série Trèfle
      76: '1♦',     // 1ère série Carreau
      84: '1♥',     // 1ère série Cœur
      92: '1♠',     // 1ère série Pique
      100: '1N',    // 1ère série Nationale
    };

    // Return exact match or 'NC' if not found
    return ivMap[iv] ?? 'NC';
  }

  hasNoLicenseIdentifier(member: Member): boolean {
    const licenseNumber = (member.license_number || '').trim();
    return licenseNumber.startsWith('?') || member.person_id === undefined || member.person_id === null;
  }

  hasPaidMembership(member: Member): boolean {
    return !!member.membership_date;
  }

  isLicensed(member: Member): boolean {
    return this.LICENSED_STATUSES.includes(member.license_status);
  }

  isInFfbBase(member: Member, ffbBaseReferences: FfbBaseReferences): boolean {
    const personId = member.person_id;
    if (personId !== undefined && personId !== null && ffbBaseReferences.has(personId)) {
      return true;
    }

    const licenseNumber = (member.license_number || '').trim();
    if (licenseNumber && ffbBaseReferences.has(licenseNumber)) {
      return true;
    }

    return false;
  }

  buildFfbBaseReferences(licensees: ClubMember[]): FfbBaseReferences {
    const refs = new Set<number | string>();
    licensees.forEach((licensee) => {
      refs.add(licensee.id);
      refs.add(licensee.license_number);
    });
    return refs;
  }

  isLicenseAtClub(member: Member): boolean {
    return member.license_taken_at === this.CLUB_LICENSE_NAME;
  }

  getMemberStatus(member: Member, ffbBaseReferences: FfbBaseReferences): MemberStatus {
    if (this.isInFfbBase(member, ffbBaseReferences)) {
      if (this.isLicensed(member) && this.isLicenseAtClub(member)) {
        return MemberStatus.CLUB_LICENSEE;
      }
      return MemberStatus.SYMPATHISANT;
    }

    if (this.hasPaidMembership(member) && this.hasNoLicenseIdentifier(member)) {
      return MemberStatus.NO_LICENSE;
    }

    return MemberStatus.NON_ADHERENT;
  }

  getNoLicenseMembers(members: Member[], ffbBaseReferences: FfbBaseReferences): Member[] {
    return members.filter((member) => this.getMemberStatus(member, ffbBaseReferences) === MemberStatus.NO_LICENSE);
  }

  computeStatusCounters(members: Member[], ffbBaseReferences: FfbBaseReferences): MemberStatusCounters {
    let clubLicensees = 0;
    let sympathisants = 0;
    let noLicense = 0;
    let nonAdherents = 0;

    members.forEach((member) => {
      const status = this.getMemberStatus(member, ffbBaseReferences);
      if (status === MemberStatus.CLUB_LICENSEE) {
        clubLicensees += 1;
      } else if (status === MemberStatus.SYMPATHISANT) {
        sympathisants += 1;
      } else if (status === MemberStatus.NO_LICENSE) {
        noLicense += 1;
      } else if (status === MemberStatus.NON_ADHERENT) {
        nonAdherents += 1;
      }
    });

    return {
      clubLicensees,
      sympathisants,
      ffbAdherents: clubLicensees + sympathisants,
      noLicense,
      nonAdherents,
    };
  }

  getCollectedLicenses(members: Member[], operations: MemberOperation[]): string[] {
    const collected: string[] = [];

    members.forEach((member) => {
      if (member.license_status === 'duly_registered') {
        return;
      }

      const fullName = this.full_name(member);
      const licPaid = operations
        .filter((op) => op.member === fullName)
        .some((op) => !!op.values['LIC']);

      if (licPaid) {
        collected.push(fullName);
      }
    });

    return collected;
  }

  getMissingMembership(members: Member[], operations: MemberOperation[]): string[] {
    const missing: string[] = [];

    members.forEach((member) => {
      if (member.license_status === 'unregistered') {
        return;
      }

      const fullName = this.full_name(member);
      const adhPaid = operations
        .filter((op) => op.member === fullName)
        .some((op) => op.values['ADH'] !== undefined && op.values['ADH'] !== null);

      if (!adhPaid) {
        missing.push(fullName);
      }
    });

    return missing;
  }

  getBuyWithoutMembership(members: Member[], operations: MemberOperation[]): string[] {
    const buyWithoutMembership: string[] = [];

    members.forEach((member) => {
      const fullName = this.full_name(member);
      const memberOperations = operations.filter((op) => op.member === fullName);
      const hasAdh = memberOperations.some((op) => !!op.values['ADH']);
      const hasOther = memberOperations.some((op) => Object.keys(op.values).some((key) => key !== 'ADH'));

      if (!hasAdh && hasOther) {
        buyWithoutMembership.push(fullName);
      }
    });

    return buyWithoutMembership;
  }

}