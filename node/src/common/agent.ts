import type { MakeInit } from '@root/utils'
import type { Agent } from './proto'
import type { Diagnostic } from './diagnostic'

import { AgentSchema, AgentType } from './proto'
import { DiagnosticCode } from './diagnostic'

import { create } from '@bufbuild/protobuf'

/**
 * Creates an Agent, a performing voice referenced by lines through its id.
 */
export const makeAgent = (init?: MakeInit<typeof AgentSchema>): Agent => {
  return create(AgentSchema, init)
}

/**
 * Validates an Agent: an OTHER type must carry the source's own word in `raw`.
 */
export const validateAgent = (agent: Agent, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (agent.type === AgentType.OTHER && agent.raw === undefined) {
    diagnostics.push({ path, code: DiagnosticCode.AgentRawMissing })
  }
  return diagnostics
}
