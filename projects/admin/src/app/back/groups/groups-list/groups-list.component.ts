import { Component, OnInit } from '@angular/core';
import { Group_icons, Group_names, UserInGroup } from '../../../common/authentification/group.interface';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { Member } from '../../../common/interfaces/member.interface';
import { ToastService } from '../../../common/services/toast.service';
import { MembersService } from '../../../common/services/members.service';
import { Schema } from '../../../../../../../amplify/data/resource';
import { firstValueFrom, take } from 'rxjs';

interface Profil extends UserInGroup {
  member: Member | null;
  highest_group: string | null;
  prev_group: string | null; // to keep track of the previous group
}

@Component({
  selector: 'app-groups-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './groups-list.component.html',
  styleUrl: './groups-list.component.scss'
})
export class GroupsListComponent implements OnInit {

  groups: string[] = Object.values(Group_names);
  icons: { [K: string]: string } = Group_icons;

  usersArray: Profil[] = [];
  usersWithoutGroup: Profil[] = [];
  loading = true;
  loadError = '';
  openAccountsCount = 0;
  emailSortDirection: 'asc' | 'desc' | null = null;

  constructor(
    private membersService: MembersService,
    private toastService: ToastService
  ) {
  }

  async ngOnInit() {
    const _users: Map<string, Profil> = new Map();
    _users.clear();
    try {
      const [allCognitoUsers, members] = await Promise.all([
        this._listUsers(),
        firstValueFrom(this.membersService.listMembers().pipe(take(1))),
      ]);
      const membersByEmail = new Map(
        members.map(member => [member.email.trim().toLowerCase(), member] as const)
      );
      this.openAccountsCount = allCognitoUsers.filter(user => user.Enabled !== false).length;
      const groupedUsernames = new Set<string>();

      for (const group of this.groups) {  // from highest to lowest 
        const users = await this._listUsersInGroup(group);
        for (const user of users) {
          groupedUsernames.add(user.Username);
          const member = membersByEmail.get(this.userEmail(user)) ?? null;
          const profil: Profil = { ...user, member, highest_group: group, prev_group: group };
          if (!_users.has(user.Username)) {
            _users.set(user.Username, profil);
          } else {
            // If user already in a group , remove it from this group
            this._removeUserFromGroup(user.Username, group)
              .catch((error) => { this.toastService.showError('Gestion des accès', `Opération refusée: ${error}`); });
          }
        }
      }
      this.usersArray = Array.from(_users.values()).sort((a, b) => {
        // Trier d'abord par groupe
        const groupIndexA = this.groups.indexOf(a.highest_group!);
        const groupIndexB = this.groups.indexOf(b.highest_group!);

        if (groupIndexA !== groupIndexB) {
          return groupIndexA - groupIndexB;
        }
        // Puis par lastname à l'intérieur du même groupe
        return this.profileName(a).localeCompare(this.profileName(b), 'fr', { sensitivity: 'base' });
      });

      this.usersWithoutGroup = allCognitoUsers
        .filter(user => !groupedUsernames.has(user.Username))
        .map(user => ({
          ...user,
          member: membersByEmail.get(this.userEmail(user)) ?? null,
          highest_group: null,
          prev_group: null,
        }))
        .sort((a, b) => this.profileName(a).localeCompare(this.profileName(b), 'fr', { sensitivity: 'base' }));

    } catch (error) {
      console.error(`Error listing users `, error);
      this.loadError = 'La liste des comptes et des droits n’a pas pu être chargée complètement.';
    } finally {
      this.loading = false;
    }
  }



  async updateUserGroup(user: Profil, new_group: string) {
    console.log(`Updating group for user ${user.Username} from ${user.prev_group} to ${new_group}`);
    const previousGroup = user.prev_group;
    try {
      await this._addUserToGroup(user.Username, new_group);
      if (previousGroup && previousGroup !== new_group) {
        await this._removeUserFromGroup(user.Username, previousGroup);
      }
      user.prev_group = new_group;
      user.highest_group = new_group;
      this.usersWithoutGroup = this.usersWithoutGroup.filter(item => item.Username !== user.Username);
      if (!this.usersArray.some(item => item.Username === user.Username)) {
        this.usersArray = [...this.usersArray, user];
      }
      this.sortNominalUsers();
      this.toastService.showSuccess('Gestion des accès', `${this.profileName(user)} mis dans le groupe ${new_group}`);
    } catch (error) {
      user.highest_group = previousGroup;
      this.toastService.showError('Gestion des accès', `Opération refusée: ${error}`);
    }
  }

  userEmail(user: UserInGroup): string {
    return (user.Attributes.find(attr => attr.Name === 'email')?.Value || '').trim().toLowerCase();
  }

  profileName(user: Profil): string {
    return user.member
      ? `${user.member.lastname} ${user.member.firstname}`.trim()
      : 'Fiche membre introuvable';
  }

  sortByEmail(): void {
    this.emailSortDirection = this.emailSortDirection === 'asc' ? 'desc' : 'asc';
    const direction = this.emailSortDirection === 'asc' ? 1 : -1;
    this.usersArray = [...this.usersArray].sort((left, right) =>
      direction * this.userEmail(left).localeCompare(this.userEmail(right), 'fr', { sensitivity: 'base' })
    );
  }

  sortByRightsAndName(): void {
    this.sortNominalUsers();
  }

  async deleteOrphanAccount(user: Profil): Promise<void> {
    if (user.member) {
      return;
    }

    const email = this.userEmail(user);
    if (!window.confirm(`Supprimer définitivement le compte Cognito ${email} ?`)) {
      return;
    }

    try {
      await this._deleteUser(user.Username);
      this.usersWithoutGroup = this.usersWithoutGroup.filter(item => item.Username !== user.Username);
      this.usersArray = this.usersArray.filter(item => item.Username !== user.Username);
      if (user.Enabled !== false) {
        this.openAccountsCount = Math.max(0, this.openAccountsCount - 1);
      }
      this.toastService.showSuccess('Gestion des accès', `Compte ${email} supprimé`);
    } catch (error) {
      this.toastService.showError('Gestion des accès', `Suppression refusée: ${error}`);
    }
  }

  private sortNominalUsers(): void {
    this.emailSortDirection = null;
    this.usersArray = [...this.usersArray].sort((a, b) => {
      const groupDifference = this.groups.indexOf(a.highest_group!) - this.groups.indexOf(b.highest_group!);
      return groupDifference !== 0
        ? groupDifference
        : this.profileName(a).localeCompare(this.profileName(b), 'fr', { sensitivity: 'base' });
    });
  }




  async _listUsersInGroup(groupName: string): Promise<UserInGroup[]> {
    const client = generateClient<Schema>();
    try {
      const { data, errors } = await client.mutations.listUsersInGroup({ groupName: groupName });
      if (errors && errors.length > 0) {
        console.error("Errors occurred while listing users in group:", errors);
        throw errors;
      } else {
        return this.parseUsersResponse(data, 'listUsersInGroup');
      }
    } catch (error) {
      console.error(`Error fetching users for group ${groupName}:`, error);
      throw error;
    }
  }

  async _listUsers(): Promise<UserInGroup[]> {
    const client = generateClient<Schema>();
    const { data, errors } = await client.queries.listUsers();
    if (errors && errors.length > 0) {
      throw errors;
    }
    return this.parseUsersResponse(data, 'listUsers');
  }

  private parseUsersResponse(data: unknown, operation: string): UserInGroup[] {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).Users)) {
      throw new Error(`Invalid ${operation} response`);
    }
    return (parsed as { Users: UserInGroup[] }).Users;
  }

  // User management methods

  private _error_handling(errors: any): any {
    console.log(`error`, errors);
    if (errors && typeof errors === 'object' && 'errorType' in errors) {
      throw (errors as any).errorType; // Rethrow the error to be handled by the caller
    } else {
      throw errors;
    }
  }

  async _addUserToGroup(userId: string, groupName: string) {
    const client = generateClient<Schema>()
    try {
      const { data, errors } = await client.mutations.addUserToGroup({ userId: userId, groupName: groupName });
      if (errors) this._error_handling(errors)
    }
    catch (error) { this._error_handling(error) }
  }

  async _removeUserFromGroup(userId: string, groupName: string) {
    const client = generateClient<Schema>();
    try {
      const { data, errors } = await client.mutations.removeUserFromGroup({ userId: userId, groupName: groupName });
      if (errors) this._error_handling(errors)
    }
    catch (error) { this._error_handling(error) }
  }

  async _deleteUser(userId: string): Promise<void> {
    const client = generateClient<Schema>();
    const { errors } = await client.mutations.deleteUser({ userId });
    if (errors) {
      this._error_handling(errors);
    }
  }

}
