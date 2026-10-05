import {
  ListUsersCommand,
  type ListUsersCommandOutput,
  ListUsersInGroupCommand,
  type ListUsersInGroupCommandOutput,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider'

type SendListUsersInGroup = (
  command: ListUsersInGroupCommand,
) => Promise<ListUsersInGroupCommandOutput>

type SendListUsers = (
  command: ListUsersCommand,
) => Promise<ListUsersCommandOutput>

export async function listAllUsers(
  send: SendListUsers,
  userPoolId: string,
): Promise<UserType[]> {
  const users: UserType[] = []
  let paginationToken: string | undefined

  do {
    const response = await send(new ListUsersCommand({
      UserPoolId: userPoolId,
      Limit: 60,
      PaginationToken: paginationToken,
    }))
    users.push(...(response.Users ?? []))
    paginationToken = response.PaginationToken
  } while (paginationToken)

  return users
}

export async function listAllUsersInGroup(
  send: SendListUsersInGroup,
  userPoolId: string,
  groupName: string,
): Promise<UserType[]> {
  const users: UserType[] = []
  let nextToken: string | undefined

  do {
    const response = await send(new ListUsersInGroupCommand({
      UserPoolId: userPoolId,
      GroupName: groupName,
      Limit: 60,
      NextToken: nextToken,
    }))
    users.push(...(response.Users ?? []))
    nextToken = response.NextToken
  } while (nextToken)

  return users
}