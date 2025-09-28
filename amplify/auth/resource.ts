import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';
import { addUserToGroup } from '../data/add-user-to-group/resource';
import { listUsersInGroup } from '../data/list-users-in-group/resource';
import { removeUserFromGroup } from '../data/remove-user-from-group/resource';

// import { Group_names } from '../../projects/admin/src/app/common/authentification/group.interface';
 enum Group_names {
  System = 'Systeme',
  Admin = 'Administrateur',
  Editor = 'Editeur',
  Support = 'Contributeur',
  Member = 'Membre'
}



/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true

  },

  groups: Object.values(Group_names),

   triggers: { postConfirmation, },

  access: (allow) => [
    allow.resource(addUserToGroup).to(["addUserToGroup"]),
    allow.resource(listUsersInGroup).to(["listUsersInGroup"]),
    allow.resource(removeUserFromGroup).to(["removeUserFromGroup"]),

    allow.resource(postConfirmation).to(["addUserToGroup"]),
  ],

  userAttributes: {
    "custom:member_id": {
      dataType: "String",
      mutable: true,
    }
  },

});
