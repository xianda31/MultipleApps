import type { Schema } from '../resource'
import { env } from '$amplify/env/list-users'
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'
import { listAllUsers } from '../list-users-in-group/pagination'

type Handler = Schema['listUsers']['functionHandler']
const client = new CognitoIdentityProviderClient()

export const handler: Handler = async () => {
  const users = await listAllUsers(
    (command) => client.send(command),
    env.AMPLIFY_AUTH_USERPOOL_ID,
  )

  return { Users: users }
}