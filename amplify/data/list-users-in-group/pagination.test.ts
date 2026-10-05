import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ListUsersCommand,
  ListUsersInGroupCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider'
import { listAllUsers, listAllUsersInGroup } from './pagination'

test('lists every Cognito user page', async () => {
  const commands: ListUsersCommand[] = []
  const users = await listAllUsers(async (command) => {
    commands.push(command)
    return command.input.PaginationToken
      ? { Users: [{ Username: 'member-68' }], $metadata: {} }
      : {
          Users: Array.from({ length: 67 }, (_, index) => ({ Username: `member-${index + 1}` })),
          PaginationToken: 'page-2',
          $metadata: {},
        }
  }, 'pool-1')

  assert.equal(users.length, 68)
  assert.equal(commands.length, 2)
  assert.equal(commands[0].input.Limit, 60)
  assert.equal(commands[1].input.PaginationToken, 'page-2')
})

test('lists every Cognito page for a group', async () => {
  const firstPage = Array.from({ length: 60 }, (_, index): UserType => ({
    Username: `member-${index + 1}`,
  }))
  const secondPage = Array.from({ length: 8 }, (_, index): UserType => ({
    Username: `member-${index + 61}`,
  }))
  const commands: ListUsersInGroupCommand[] = []

  const users = await listAllUsersInGroup(async (command) => {
    commands.push(command)
    return command.input.NextToken
      ? { Users: secondPage, $metadata: {} }
      : { Users: firstPage, NextToken: 'page-2', $metadata: {} }
  }, 'pool-1', 'Membre')

  assert.equal(users.length, 68)
  assert.equal(commands.length, 2)
  assert.equal(commands[0].input.Limit, 60)
  assert.equal(commands[0].input.NextToken, undefined)
  assert.equal(commands[1].input.NextToken, 'page-2')
  assert.equal(users[67].Username, 'member-68')
})