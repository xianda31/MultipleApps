import type { Schema } from '../resource'
import { env } from '$amplify/env/confirm-user'
import {
  AdminAddUserToGroupCommand,
  AdminConfirmSignUpCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'

type Handler = Schema['confirmUser']['functionHandler']
const client = new CognitoIdentityProviderClient()

export const handler: Handler = async (event) => {
  const username = event.arguments.userId
  const userPoolId = env.AMPLIFY_AUTH_USERPOOL_ID

  await client.send(new AdminConfirmSignUpCommand({
    UserPoolId: userPoolId,
    Username: username,
  }))
  await client.send(new AdminAddUserToGroupCommand({
    UserPoolId: userPoolId,
    Username: username,
    GroupName: env.TARGET_GROUP,
  }))

  return true
}