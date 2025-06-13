import type { Schema } from "../resource"
import { env } from "$amplify/env/add-user-to-group"
import {
  ListUsersInGroupCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider"

type Handler = Schema["listUsersInGroup"]["functionHandler"]
const client = new CognitoIdentityProviderClient()

export const handler: Handler = async (event) => {
  const { groupName } = event.arguments
  const command = new ListUsersInGroupCommand({
    UserPoolId: env.AMPLIFY_AUTH_USERPOOL_ID,
    GroupName: groupName,
    // Limit: 60, // Optional: specify the maximum number of users to return
    // NextToken: event.nextToken, // Optional: for pagination
  })
  const response = await client.send(command)
  return response
}

