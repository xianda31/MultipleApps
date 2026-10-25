import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, firstValueFrom, take } from 'rxjs';
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
import { hasSameNormalizedMemberName } from './member-identity.util';

export interface MemberMergeConflict {
    clubMember: ClubMember;
    person: PersonV2 | null;
    candidates: Member[];
}

export interface MemberSyncProgress {
    percent: number;
    label: string;
}

@Injectable({
    providedIn: 'root'
})
export class MemberSyncService {
    private syncInFlight: Promise<Member[]> | null = null;
    private lastSyncAt = 0;
    private readonly MIN_SYNC_INTERVAL_MS = 15_000;
    private pendingMergeConflicts: MemberMergeConflict[] = [];
    private readonly syncProgressSubject = new BehaviorSubject<MemberSyncProgress>({
        percent: 0,
        label: 'Préparation de la synchronisation...',
    });
    readonly syncProgress$ = this.syncProgressSubject.asObservable();

    constructor(
        private membersService: MembersService,
        private licenseesService: LicenseesService,
        private ffbService: FFB_proxyService,
        private systemDataService: SystemDataService,
        private bookService: BookService,
    ) { }

    async ensureMembersSynchronized(force = false): Promise<Member[]> {
        const synchronizationSeason = this.systemDataService.get_local_season();
        if (!this.canSynchronizeSeason(synchronizationSeason)) {
            return this.getSortedMembersSnapshot();
        }

        if (this.syncInFlight) {
            return this.syncInFlight;
        }

        const now = Date.now();
        if (!force && this.lastSyncAt > 0 && now - this.lastSyncAt < this.MIN_SYNC_INTERVAL_MS) {
            return this.getMembersSnapshot();
        }

        this.syncInFlight = this.runSynchronization(synchronizationSeason).finally(() => {
            this.syncInFlight = null;
        });

        return this.syncInFlight;
    }

    async createMemberWithComputedStatus(member: Member): Promise<void> {
        const nextMember: Member = {
            ...member,
            memberStatus: this.membersService.resolveMemberStatus(member),
            lifecycleStatus: member.lifecycleStatus ?? 'ACTIVE',
        };
        await this.membersService.createMember(nextMember);
    }

    getPendingMergeConflicts(): MemberMergeConflict[] {
        return this.pendingMergeConflicts.map((conflict) => ({
            ...conflict,
            candidates: [...conflict.candidates],
        }));
    }

    async mergeMemberConflict(conflict: MemberMergeConflict, memberId: string): Promise<void> {
        const candidate = conflict.candidates.find((member) => member.id === memberId);
        if (!candidate) {
            throw new Error(`Member merge candidate ${memberId} is no longer available`);
        }

        const updatedMember = this.buildUpdatedMember(candidate, conflict.clubMember, conflict.person);
        if (updatedMember) {
            await this.membersService.updateMember(updatedMember);
        }
        this.removePendingConflict(conflict.clubMember.id);
    }

    async createDistinctMember(conflict: MemberMergeConflict): Promise<void> {
        await this.membersService.createMember(this.createNewMember(conflict.clubMember, conflict.person));
        this.removePendingConflict(conflict.clubMember.id);
    }

    private async runSynchronization(synchronizationSeason: string): Promise<Member[]> {
        this.pendingMergeConflicts = [];
        this.reportProgress(3, 'Chargement des données FFB et comptables...');
        const [operations, licensees] = await Promise.all([
            this.loadOperations(),
            firstValueFrom(this.licenseesService.getClubMembers$().pipe(take(1))),
        ]);

        if (!this.canSynchronizeSeason(synchronizationSeason)) {
            return this.getSortedMembersSnapshot();
        }

        if (licensees.length === 0) {
            throw new Error('La FFB n’a retourné aucun adhérent ; synchronisation annulée');
        }

        let members = await this.getMembersSnapshot();

        for (const [index, licensee] of licensees.entries()) {
            if (!this.canSynchronizeSeason(synchronizationSeason)) {
                return this.getSortedMembersSnapshot();
            }
            await this.createOrUpdateMember(members, licensee);
            this.reportProgress(
                8 + Math.round(((index + 1) / licensees.length) * 47),
                `Fusion des membres FFB : ${index + 1}/${licensees.length}`
            );
        }

        if (!this.canSynchronizeSeason(synchronizationSeason)) {
            return this.getSortedMembersSnapshot();
        }
        this.reportProgress(58, 'Contrôle des rattachements FFB...');
        members = await this.commitPhase(() => this.resetObsoleteLicenses(members, licensees));

        if (!this.canSynchronizeSeason(synchronizationSeason)) {
            return this.getSortedMembersSnapshot();
        }
        this.reportProgress(65, 'Mise à jour des adhésions...');
        members = await this.commitPhase(() => this.syncMembershipDates(members, operations, synchronizationSeason));

        if (!this.canSynchronizeSeason(synchronizationSeason)) {
            return this.getSortedMembersSnapshot();
        }
        this.reportProgress(72, 'Recherche des licences prises dans un autre club...');
        members = await this.commitPhase(() => this.syncExternalLicenseDetails(members, licensees));

        if (!this.canSynchronizeSeason(synchronizationSeason)) {
            return this.getSortedMembersSnapshot();
        }
        this.reportProgress(96, 'Finalisation des statuts...');
        members = await this.commitPhase(() => this.ensureMemberStatuses(members));

        members = await this.getMembersSnapshot();
        this.lastSyncAt = Date.now();
        this.reportProgress(100, 'Synchronisation terminée');

        return this.sortMembers(members);
    }

    private reportProgress(percent: number, label: string): void {
        this.syncProgressSubject.next({ percent, label });
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

    private async getSortedMembersSnapshot(): Promise<Member[]> {
        return this.sortMembers(await this.getMembersSnapshot());
    }

    private sortMembers(members: Member[]): Member[] {
        return members.sort((a, b) => a.lastname.localeCompare(b.lastname, 'fr', { sensitivity: 'base' }));
    }

    private canSynchronizeSeason(season: string): boolean {
        return this.systemDataService.get_local_season() === season
            && this.systemDataService.get_accounting_season_state().initializedSeason === season;
    }

    private async commitPhase(phase: () => Promise<void>): Promise<Member[]> {
        await phase();
        return this.getMembersSnapshot();
    }

    private async createOrUpdateMember(members: Member[], clubMember: ClubMember): Promise<void> {
        const licenseNumber = clubMember.license_number?.trim();
        const existingMember = members.find((member) => member.person_id === clubMember.id)
            ?? (licenseNumber
                ? members.find((member) => member.license_number?.trim() === licenseNumber)
                : undefined);

        if (existingMember) {
            const personV2 = existingMember.email?.trim()
                ? null
                : await this.ffbService.getFFBPerson(clubMember.id).catch(() => null);
            const updatedMember = this.buildUpdatedMember(existingMember, clubMember, personV2);
            if (updatedMember) {
                await this.membersService.updateMember(updatedMember);
            }
            return;
        }

        const personV2 = await this.ffbService.getFFBPerson(clubMember.id).catch(() => null);
        const candidates = members.filter((member) => hasSameNormalizedMemberName(member, clubMember));
        if (candidates.length > 0) {
            this.pendingMergeConflicts.push({
                clubMember,
                person: personV2,
                candidates: [...candidates],
            });
            console.warn('[MemberSync] Member creation suspended pending identity review', {
                ffbPersonId: clubMember.id,
                licenseNumber,
                candidateIds: candidates.map((candidate) => candidate.id),
            });
            return;
        }

        const newMember = this.createNewMember(clubMember, personV2);
        await this.membersService.createMember(newMember);
    }

    private buildUpdatedMember(member: Member, clubMember: ClubMember, personV2: PersonV2 | null): Member | null {
        const nextMember: Member = {
            id: member.id,
            license_number: clubMember.license_number,
            gender: normalizeGender(clubMember.gender),
            firstname: clubMember.firstName,
            lastname: clubMember.lastName.toUpperCase(),
            birthdate: clubMember.birthdate,
            city: member.city?.trim() || personV2?.city || '',
            email: member.email?.trim() || personV2?.email?.trim() || '',
            phone_one: member.phone_one?.trim() || personV2?.phone || '',
            license_taken_at: clubMember.club?.label ?? 'BCSTO',
            register_date: clubMember.mainRegistration?.createdAt ? clubMember.mainRegistration.createdAt.split('T')[0] : '',
            orga_license_name: member.orga_license_name ? '' : member.orga_license_name,
            license_status: clubMember.licence ? LicenseStatus.DULY_REGISTERED : LicenseStatus.UNREGISTERED,
            accept_mailing: member.accept_mailing,
            membership_date: member.membership_date,
            person_id: clubMember.id,
            memberStatus: this.computeMemberStatusFromClubMember(clubMember),
            lifecycleStatus: member.lifecycleStatus ?? 'ACTIVE',
            lifecycleChangedAt: member.lifecycleChangedAt,
            lifecycleChangedBy: member.lifecycleChangedBy,
            lifecycleReason: member.lifecycleReason,
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

    private removePendingConflict(personId: number): void {
        this.pendingMergeConflicts = this.pendingMergeConflicts.filter(
            (conflict) => conflict.clubMember.id !== personId
        );
    }

    private createNewMember(clubMember: ClubMember, personV2: PersonV2 | null): Member {
        const nextMember: Member = {
            id: '',
            gender: normalizeGender(clubMember.gender),
            firstname: clubMember.firstName,
            lastname: clubMember.lastName.toUpperCase(),
            license_number: clubMember.license_number,
            birthdate: clubMember.birthdate,
            city: personV2?.city ?? '',
            email: personV2?.email ?? '',
            accept_mailing: !!personV2?.email,
            phone_one: personV2?.phone ?? '',
            license_status: clubMember.licence ? LicenseStatus.DULY_REGISTERED : LicenseStatus.UNREGISTERED,
            license_taken_at: clubMember.club?.label ?? 'BCSTO',
            register_date: clubMember.mainRegistration?.createdAt ? clubMember.mainRegistration.createdAt.split('T')[0] : '',
            orga_license_name: '',
            membership_date: '',
            person_id: clubMember.id,
            memberStatus: this.computeMemberStatusFromClubMember(clubMember),
            lifecycleStatus: 'ACTIVE',
            iv: undefined,
            iv_code: undefined,
        };
        return nextMember;
    }

    private async resetObsoleteLicenses(members: Member[], licensees: ClubMember[]): Promise<void> {
        if (licensees.length === 0) {
            throw new Error('La liste FFB est vide ; remise à zéro des licences annulée');
        }

        const updates: Promise<any>[] = [];

        for (const member of members) {
            const memberLicense = member.license_number?.trim();
            const existsInFFB = licensees.some((licensee) =>
                licensee.id === member.person_id
                || (!!memberLicense && licensee.license_number?.trim() === memberLicense)
            );
            if (!existsInFFB && member.license_status !== LicenseStatus.UNREGISTERED) {
                const updatedMember: Member = {
                    ...member,
                    license_status: LicenseStatus.UNREGISTERED,
                };
                updatedMember.memberStatus = this.membersService.deriveMemberStatusFromData(updatedMember);
                updates.push(
                    this.membersService.updateMember(updatedMember)
                );
            }
        }

        await Promise.all(updates);
    }

    private async syncExternalLicenseDetails(members: Member[], clubLicensees: ClubMember[]): Promise<void> {
        const clubReferences = this.membersService.buildFfbBaseReferences(clubLicensees);
        const candidates = members.filter((member) => {
            const licenseNumber = member.license_number?.trim();
            return this.membersService.getLifecycleStatus(member) === 'ACTIVE'
                && !!licenseNumber
                && !licenseNumber.startsWith('?')
                && !this.membersService.isInFfbBase(member, clubReferences);
        });

        const batchSize = 5;
        for (let index = 0; index < candidates.length; index += batchSize) {
            const batch = candidates.slice(index, index + batchSize);
            await Promise.all(
                batch.map((member) => this.syncExternalLicenseDetail(member))
            );
            const completed = Math.min(index + batch.length, candidates.length);
            this.reportProgress(
                72 + Math.round((completed / candidates.length) * 22),
                `Recherche des licences externes : ${completed}/${candidates.length}`
            );
        }
    }

    private async syncExternalLicenseDetail(member: Member): Promise<void> {
        const normalizedLicense = member.license_number.trim().padStart(8, '0');
        const searchHints = [
            normalizedLicense.replace(/^0+/, ''),
            `${member.lastname} ${member.firstname}`.trim(),
        ].filter((hint, index, hints) => hint.length > 3 && hints.indexOf(hint) === index);
        let currentLicense: ClubMember | undefined;

        for (const hint of searchHints) {
            try {
                const result = await this.ffbService.searchPlayersSuchAs(hint, { maxPerPage: 10 });
                currentLicense = result.items.find((candidate) =>
                    candidate.id === member.person_id
                    || candidate.license_number.trim().padStart(8, '0') === normalizedLicense
                );
                if (currentLicense) break;
            } catch (error) {
                console.warn('[MemberSync] External FFB license lookup failed', {
                    memberId: member.id,
                    licenseNumber: normalizedLicense,
                    hint,
                    error,
                });
                return;
            }
        }

        const externalLicenseClub = currentLicense?.licence
            ? currentLicense.club?.label || currentLicense.club?.name || currentLicense.club?.ffbCode || ''
            : '';
        const externalLicenseDate = currentLicense?.licence && currentLicense.mainRegistration?.createdAt
            ? currentLicense.mainRegistration.createdAt.split('T')[0]
            : '';

        if (
            member.orga_license_name === externalLicenseClub
            && member.register_date === externalLicenseDate
        ) {
            return;
        }

        await this.membersService.updateMember({
            ...member,
            orga_license_name: externalLicenseClub,
            register_date: externalLicenseDate,
        });
    }

    private async syncMembershipDates(
        members: Member[],
        operations: Revenue[],
        selectedSeason: string,
    ): Promise<void> {
        const updates: Promise<any>[] = [];
        const selectedSeasonStart = new Date(this.systemDataService.start_date(selectedSeason));

        for (const member of members) {
            const fullName = this.membersService.full_name(member);
            const memberOps = operations.filter((op) => op.member === fullName);
            const firstAdh = memberOps.find((op) => 'ADH' in op.values);
            if (!firstAdh) {
                if (!member.membership_date) {
                    continue;
                }

                const membershipDate = new Date(member.membership_date);
                const keepHistoricalDate = !Number.isNaN(membershipDate.getTime())
                    && !Number.isNaN(selectedSeasonStart.getTime())
                    && membershipDate < selectedSeasonStart;

                const nextMembershipDate = keepHistoricalDate ? member.membership_date : '';
                if (nextMembershipDate !== member.membership_date) {
                    const updatedMember: Member = {
                        ...member,
                        membership_date: nextMembershipDate,
                    };
                    updatedMember.memberStatus = this.membersService.resolveMemberStatus(updatedMember);
                    updates.push(
                        this.membersService.updateMember(updatedMember)
                    );
                }
                continue;
            }

            const newMembershipDate = firstAdh.date;

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
