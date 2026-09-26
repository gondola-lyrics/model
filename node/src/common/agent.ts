import type { MakeInit } from '@root/utils'
import type { Agent } from './proto'
import type { Diagnostic } from './diagnostic'

import { AgentSchema, AgentType, TextSchema } from './proto'
import { DiagnosticCode } from './diagnostic'

import { canonicalizeList } from '@root/utils'
import { canonicalizeText } from './text'

import { create } from '@bufbuild/protobuf'

/**
 * Creates an Agent, a performing voice referenced by lines through its id.
 */
export const makeAgent = (init?: MakeInit<typeof AgentSchema>): Agent => {
  return create(AgentSchema, init)
}

/**
 * Validates an Agent: its id must be non-empty, and an OTHER type must carry the source's own word in `raw`.
 */
export const validateAgent = (agent: Agent, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (agent.id === '') {
    diagnostics.push({ path, code: DiagnosticCode.AgentIdEmpty })
  }
  if (agent.type === AgentType.OTHER && agent.raw === undefined) {
    diagnostics.push({ path, code: DiagnosticCode.AgentRawMissing })
  }
  return diagnostics
}

/**
 * Returns a copy of the Agent with its names canonicalized and all-default entries dropped.
 */
export const canonicalizeAgent = (agent: Agent): Agent => {
  return { ...agent, names: canonicalizeList(TextSchema, agent.names, canonicalizeText) }
}
