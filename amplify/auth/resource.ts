import { defineAuth } from '@aws-amplify/backend';
import { data } from '../data/resource';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true

  },
  userAttributes: {
    "custom:member_id": {
      dataType: "String",
      // mutable: true,
    }
  },

  groups: ["ADMIN", "EVERYONE"],
});
