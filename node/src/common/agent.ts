import type { MakeInit } from '@root/utils'
import type { Agent } from './proto'

import { AgentSchema } from './proto'

import { create } from '@bufbuild/protobuf'

/**
 * Creates an Agent, a performing voice referenced by lines through its id.
 */
export const makeAgent = (init?: MakeInit<typeof AgentSchema>): Agent => {
  return create(AgentSchema, init)
}
