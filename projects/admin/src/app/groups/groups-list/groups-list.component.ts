import { Component, OnInit } from '@angular/core';
import { Group_icons, Group_names, UserInGroup } from '../../../../../common/authentification/group.interface';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';
import { Schema } from '../../../../../../amplify/data/resource';
import { Member } from '../../../../../common/member.interface';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { MembersService } from '../../../../../common/members/services/members.service';

interface Profil extends UserInGroup {
  member: Member;
  highest_group: string;
  prev_group: string; // to keep track of the previous group
}

@Component({
  selector: 'app-groups-list',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './groups-list.component.html',
  styleUrl: './groups-list.component.scss'
})
export class GroupsListComponent implements OnInit {

  groups: string[] = Object.values(Group_names);
  icons: { [K: string]: string } = Group_icons;

  usersArray!: Profil[];

  constructor(
    private membersService: MembersService,
    private toastService: ToastService
  ) {
  }

  async ngOnInit() {
    const _users: Map<string, Profil> = new Map();
    _users.clear();
    try {
      for (const group of this.groups) {  // from highest to lowest 
        const users = await this._listUsersInGroup(group);
        for (const user of users) {
          const member = await this.membersService.readMember(user.Attributes.find(attr => attr.Name === 'custom:member_id')?.Value || '');
          if (member) {
            const profil: Profil = { ...user, member, highest_group: group, prev_group: group };
            if (!_users.has(member.id)) {
              _users.set(member.id, profil);
            } else {
              // If user already in a group , remove it from this group
              this._removeUserFromGroup(user.Username, group)
                .catch((error) => { this.toastService.showErrorToast('Gestion des accès', `Opération refusée: ${error}`); });
            }
          }
        }
      }
      this.usersArray = Array.from(_users.values());

    } catch (error) {
      console.error(`Error listing users `, error);
    }
  }



  updateUserGroup(user: Profil, new_group: string) {
    console.log(`Updating group for user ${user.Username} from ${user.prev_group} to ${new_group}`);
    this._removeUserFromGroup(user.Username, user.prev_group) //Remove from previous group
      .then(() => {
        // this.toastService.showSuccess('Gestion des accès', `${user.member.firstname} ${user.member.lastname} retiré du groupe ${user.prev_group}`);
        user.prev_group = new_group; // Update the previous group to the current one
      })
      .catch((error) => { this.toastService.showErrorToast('Gestion des accès', `Opération refusée: ${error}`); });

    this._addUserToGroup(user.Username, new_group) // Add to new group
      .then(() => { this.toastService.showSuccess('Gestion des accès', `${user.member.firstname} ${user.member.lastname} ajouté au groupe ${new_group}`); })
      .catch((error) => { this.toastService.showErrorToast('Gestion des accès', `Opération refusée: ${error}`); });

  }




  async _listUsersInGroup(groupName: string): Promise<UserInGroup[]> {
    const client = generateClient<Schema>();
    try {
      const { data, errors } = await client.mutations.listUsersInGroup({ groupName: groupName });
      if (errors && errors.length > 0) {
        console.error("Errors occurred while listing users in group:", errors);
        return [];
      } else {
        if (typeof data === 'string') {
          const Obj = JSON.parse(data);
          return Obj.Users;
        } else {
          console.error("Data is not a string:", data);
          return [];
        }
      }
    } catch (error) {
      console.error(`Error fetching users for group ${groupName}:`, error);
      return []; // Return an empty array or handle the error as needed
    }
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
      if(errors) this._error_handling(errors)
    }
    catch (error) { this._error_handling(error) }
  }

  async _removeUserFromGroup(userId: string, groupName: string) {
    const client = generateClient<Schema>();
    try {
      const { data, errors } = await client.mutations.removeUserFromGroup({ userId: userId, groupName: groupName });
      if(errors) this._error_handling(errors)
    }
    catch (error) { this._error_handling(error) }
  }

}
