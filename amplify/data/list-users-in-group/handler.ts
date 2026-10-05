import type { Schema } from "../resource"
import { env } from "$amplify/env/list-users-in-group"
import {
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider"
import { listAllUsersInGroup } from "./pagination"

type Handler = Schema["listUsersInGroup"]["functionHandler"]
const client = new CognitoIdentityProviderClient()

export const handler: Handler = async (event) => {
  const { groupName } = event.arguments
  const users = await listAllUsersInGroup(
    (command) => client.send(command),
    env.AMPLIFY_AUTH_USERPOOL_ID,
    groupName,
  )

  return { Users: users }
}

