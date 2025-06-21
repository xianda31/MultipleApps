import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import { getCurrentUser, fetchAuthSession } from '@aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { BehaviorSubject } from 'rxjs';
import { AuthData, AuthEvent } from './authentification_interface';
import { Schema } from '../../../amplify/data/resource';
import { Group_names, Group_priorities, UserInGroup } from './group.interface';
// import { UserType } from '@aws-sdk/client-cognito-identity-provider';





@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private _auth_event$: BehaviorSubject<AuthEvent> = new BehaviorSubject<AuthEvent>({ event: '' });
  private readonly GROUP_PRIORITY = Group_priorities;


  constructor() {

    const hubListener = (event: any) => {
      let authEvent: AuthEvent = event.payload;
      switch (authEvent.event) {
        case 'signedIn':
        case 'signedOut':
        case 'signedUp':
          // console.log('Auth event:', authEvent);
          this._auth_event$.next(authEvent);
          break;
        default:
          console.warn('Unhandled auth event:', authEvent.event);
          break;
      }
    }
    Hub.listen('auth', hubListener);
  }

  get authEvent$() {
    return this._auth_event$.asObservable();
  }

  async getCurrentUser(): Promise<AuthData> {
    try {
      const { username, userId, signInDetails } = await getCurrentUser();
      return {
        username,
        userId,
        signInDetails: signInDetails ?? undefined
      };
    } catch (error) {
      // console.error("Error fetching current user:", error);
      return { username: '', userId: '' };
    }
  }

  // User management methods

  async addUserToGroup(userId: string, groupName: string) {
    const client = generateClient<Schema>()
    try {
      const { data, errors } = await client.mutations.addUserToGroup(
        { userId: userId, groupName: groupName },
        // { authMode: 'userPool' } // Use identity pool auth mode
      );
      if (errors && errors.length > 0) {
        console.error("Errors occurred while adding user to group:", errors);
      } else {
        // console.log("User added to group successfully:", data);
      }
    }
    catch (error) {
      console.error("An error occurred while adding user to group:", error);
    }
  }

  async removeUserFromGroup(userId: string, groupName: string) {
    const client = generateClient<Schema>();
    try {
      const { data, errors } = await client.mutations.removeUserFromGroup(
        { userId: userId, groupName: groupName }
      );
      // if (errors && errors.length > 0) {
      //   console.error("Errors occurred while removing user from group:", errors);
      // } 
    } catch (error) {
      console.error("An error occurred while removing user from group:", error);
    }
  }


  async listUsersInGroup(groupName: string): Promise<UserInGroup[]> {
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
      return []; // Return an empty array or handle the error as needed
    }
  }



  async getCurrentUserGroups(): Promise<Group_names[]> {
    const session = await fetchAuthSession();
    let groupsRaw = session?.tokens?.accessToken?.payload['cognito:groups'];
    let groups: string[] = [];
    if (Array.isArray(groupsRaw)) {
      groups = groupsRaw.map(String);
    } else if (typeof groupsRaw === 'string') {
      groups = [groupsRaw];
    }
    return groups.sort((a, b) => {
        return Group_priorities[b as Group_names] - Group_priorities[a as Group_names]}) as Group_names[]; // Sort by priority
  }




}
