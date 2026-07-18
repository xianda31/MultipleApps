import { Injectable } from '@angular/core';
import { filter, firstValueFrom, take } from 'rxjs';
import { BookService } from '../../back/services/book.service';
import { Member, LicenseStatus } from '../interfaces/member.interface';
import { Revenue } from '../interfaces/accounting.interface';
import { ClubMember } from '../ffb/interface/club-member.interface';
import { PersonV2 } from '../ffb/interface/person-v2.interface';
import { normalizeGender } from '../utils/gender.util';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { LicenseesService } from './licensees.service';
import { MemberStatus } from './members.service';
import { MembersService } from './members.service';
import { SystemDataService } from './system-data.service';

@Injectable({
    providedIn: 'root'
})
export class MemberSyncService {
    private syncInFlight: Promise<Member[]> | null = null;
    private lastSyncAt = 0;
    private readonly MIN_SYNC_INTERVAL_MS = 15_000;

    constructor(
        private membersService: MembersService,
        private licenseesService: LicenseesService,
        private ffbService: FFB_proxyService,
        private systemDataService: SystemDataService,
        private bookService: BookService,
    ) { }

    async ensureMembersSynchronized(force = false): Promise<Member[]> {
        if (this.syncInFlight) {
            return this.syncInFlight;
        }

        const now = Date.now();
        if (!force && this.lastSyncAt > 0 && now - this.lastSyncAt < this.MIN_SYNC_INTERVAL_MS) {
            return this.getMembersSnapshot();
        }

        this.syncInFlight = this.runSynchronization().finally(() => {
            this.syncInFlight = null;
        });

        return this.syncInFlight;
    }

    async createMemberWithComputedStatus(member: Member): Promise<void> {
        const nextMember: Member = {
            ...member,
            memberStatus: this.membersService.resolveMemberStatus(member),
        };
        await this.membersService.createMember(nextMember);
    }

    private async runSynchronization(): Promise<Member[]> {
        const [operations, licensees] = await Promise.all([
            this.loadOperations(),
            firstValueFrom(this.licenseesService.getClubMembers$().pipe(take(1))),
        ]);

        let members = await this.getMembersSnapshot();
        const season = this.systemDataService.get_season(new Date());

        for (const licensee of licensees) {
            await this.createOrUpdateMember(members, licensee, season);
        }

        members = await this.commitPhase(() => this.resetObsoleteLicenses(members, licensees));
        members = await this.commitPhase(() => this.syncMembershipDates(members, operations));
        members = await this.commitPhase(() => this.ensureMemberStatuses(members));

        members = await this.getMembersSnapshot();
        this.lastSyncAt = Date.now();

        return members.sort((a, b) => a.lastname.localeCompare(b.lastname, 'fr', { sensitivity: 'base' }));
    }

    private async loadOperations(): Promise<Revenue[]> {
        await firstValueFrom(
            this.bookService.list_book_entries().pipe(
                filter(() => this.bookService.is_book_entries_loaded()),
                take(1)
            )
        );
        return this.bookService.get_operations();
    }

    private async getMembersSnapshot(): Promise<Member[]> {
        const members = await firstValueFrom(this.membersService.listMembers().pipe(take(1)));
        return members ?? [];
    }

    private async commitPhase(phase: () => Promise<void>): Promise<Member[]> {
        await phase();
        return this.getMembersSnapshot();
    }

    private async createOrUpdateMember(members: Member[], clubMember: ClubMember, season: string): Promise<void> {
        const existingMember = members.find((m) => m.license_number === clubMember.license_number);

        if (existingMember) {
            const updatedMember = this.buildUpdatedMember(existingMember, clubMember, season);
            if (updatedMember) {
                await this.membersService.updateMember(updatedMember);
            }
            return;
        }

        const personV2 = await this.ffbService.getFFBPerson(clubMember.id).catch(() => null);
        const newMember = this.createNewMember(clubMember, personV2, season);
        await this.membersService.createMember(newMember);
    }

    private buildUpdatedMember(member: Member, clubMember: ClubMember, season: string): Member | null {
        const nextMember: Member = {
            id: member.id,
            license_number: clubMember.license_number,
            gender: normalizeGender(clubMember.gender),
            firstname: clubMember.firstName,
            lastname: clubMember.lastName.toUpperCase(),
            birthdate: clubMember.birthdate,
            city: member.city,
            season: clubMember.licence ? season : '',
            email: member.email,
            phone_one: member.phone_one,
            license_taken_at: clubMember.club?.label ?? 'BCSTO',
            register_date: clubMember.mainRegistration?.createdAt ? clubMember.mainRegistration.createdAt.split('T')[0] : '',
            license_status: clubMember.licence ? LicenseStatus.DULY_REGISTERED : LicenseStatus.UNREGISTERED,
            accept_mailing: member.accept_mailing,
            has_avatar: member.has_avatar,
            membership_date: member.membership_date,
            person_id: clubMember.id,
            memberStatus: this.computeMemberStatusFromClubMember(clubMember),
            iv: clubMember.season?.ranking?.iv,
            iv_code: member.iv_code,
            createdAt: member.createdAt,
            updatedAt: member.updatedAt,
        };

        const current = member as unknown as Record<string, unknown>;
        const next = nextMember as unknown as Record<string, unknown>;

        for (const key of Object.keys(next)) {
            if (next[key] !== current[key]) {
                return nextMember;
            }
        }

        return null;
    }

    private createNewMember(clubMember: ClubMember, personV2: PersonV2 | null, season: string): Member {
        const nextMember: Member = {
            id: '',
            gender: normalizeGender(clubMember.gender),
            firstname: clubMember.firstName,
            lastname: clubMember.lastName.toUpperCase(),
            license_number: clubMember.license_number,
            birthdate: clubMember.birthdate,
            city: personV2?.city ?? '',
            season: clubMember.licence ? season : '',
            email: personV2?.email ?? '',
            accept_mailing: !!personV2?.email,
            phone_one: personV2?.phone ?? '',
            license_status: clubMember.licence ? LicenseStatus.DULY_REGISTERED : LicenseStatus.UNREGISTERED,
            license_taken_at: clubMember.club?.label ?? 'BCSTO',
            register_date: clubMember.mainRegistration?.createdAt ? clubMember.mainRegistration.createdAt.split('T')[0] : '',
            membership_date: '',
            has_avatar: false,
            person_id: clubMember.id,
            memberStatus: this.computeMemberStatusFromClubMember(clubMember),
            iv: undefined,
            iv_code: undefined,
        };
        return nextMember;
    }

    private async resetObsoleteLicenses(members: Member[], licensees: ClubMember[]): Promise<void> {
        const updates: Promise<any>[] = [];

        for (const member of members) {
            const existsInFFB = licensees.some((licensee) => licensee.id === member.person_id);
            if (!existsInFFB && member.license_status !== LicenseStatus.UNREGISTERED) {
                const updatedMember: Member = {
                    ...member,
                    license_status: LicenseStatus.UNREGISTERED,
                };
                updatedMember.memberStatus = this.membersService.resolveMemberStatus(updatedMember);
                updates.push(
                    this.membersService.updateMember(updatedMember)
                );
            }
        }

        await Promise.all(updates);
    }

    private async syncMembershipDates(members: Member[], operations: Revenue[]): Promise<void> {
        const updates: Promise<any>[] = [];

        for (const member of members) {
            const fullName = this.membersService.full_name(member);
            const memberOps = operations.filter((op) => op.member === fullName);
            const hasAdh = memberOps.find((op) => 'ADH' in op.values);
            const newMembershipDate = hasAdh ? hasAdh.date : '';

            if (member.membership_date !== newMembershipDate) {
                const updatedMember: Member = {
                    ...member,
                    membership_date: newMembershipDate,
                };
                updatedMember.memberStatus = this.membersService.resolveMemberStatus(updatedMember);
                updates.push(
                    this.membersService.updateMember(updatedMember)
                );
            }
        }

        await Promise.all(updates);
    }

    private async ensureMemberStatuses(members: Member[]): Promise<void> {
        const updates: Promise<any>[] = [];

        for (const member of members) {
            const computedStatus = this.membersService.resolveMemberStatus(member);
            if (member.memberStatus !== computedStatus) {
                updates.push(
                    this.membersService.updateMember({
                        ...member,
                        memberStatus: computedStatus,
                    })
                );
            }
        }

        await Promise.all(updates);
    }

    private computeMemberStatusFromClubMember(clubMember: ClubMember): MemberStatus {
        if (clubMember.licence && (clubMember.club?.label ?? 'BCSTO') === 'Bridge Club de Saint Orens') {
            return MemberStatus.CLUB_LICENSEE;
        }

        return MemberStatus.SYMPATHISANT;
    }
}
