import type { Schema } from '../resource'
import { env } from '$amplify/env/delete-user'
import {
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'

type Handler = Schema['deleteUser']['functionHandler']
const client = new CognitoIdentityProviderClient()

export const handler: Handler = async (event) => {
  await client.send(new AdminDeleteUserCommand({
    UserPoolId: env.AMPLIFY_AUTH_USERPOOL_ID,
    Username: event.arguments.userId,
  }))

  return true
}