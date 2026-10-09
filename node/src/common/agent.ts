import type { MakeInit } from '@root/utils'
import type { Agent } from './proto'
import type { Diagnostic } from './diagnostic'

import { AgentSchema, AgentType, AgentTypeSchema, TextSchema } from './proto'
import { DiagnosticCode } from './diagnostic'

import { canonicalizeList, childPath, findDuplicates, isUnresolved, lowerTag } from '@root/utils'
import { canonicalizeText, validateText } from './text'

import { create } from '@bufbuild/protobuf'

/**
 * Creates an Agent, a performing voice referenced by lines through its id.
 */
export const makeAgent = (init?: MakeInit<typeof AgentSchema>): Agent => {
  return create(AgentSchema, init)
}

/**
 * Validates an Agent: its id must be non-empty, its type must be resolved, an OTHER type must carry the source's own word in `raw`, and its names hold one entry per language.
 */
export const validateAgent = (agent: Agent, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (agent.id === '') {
    diagnostics.push({ path, code: DiagnosticCode.AgentIdEmpty })
  }
  if (isUnresolved(AgentTypeSchema, agent.type)) {
    diagnostics.push({ path: childPath(path, 'type'), code: DiagnosticCode.AgentTypeUnspecified })
  } else if (agent.type === AgentType.OTHER && agent.raw === undefined) {
    diagnostics.push({ path, code: DiagnosticCode.AgentRawMissing })
  }
  // The names are one per language rather than one per member, so a language may not repeat; an unset and an empty tag are the same default language.
  findDuplicates(agent.names, (name) => lowerTag(name.language) ?? '').forEach((i) => {
    diagnostics.push({ path: childPath(path, `names[${i}]`), code: DiagnosticCode.AgentNamesLanguageDuplicate })
  })
  agent.names.forEach((name, i) => diagnostics.push(...validateText(name, childPath(path, `names[${i}]`))))
  return diagnostics
}

/**
 * Returns a copy of the Agent with its names canonicalized and all-default entries dropped.
 */
export const canonicalizeAgent = (agent: Agent): Agent => {
  return { ...agent, names: canonicalizeList(TextSchema, agent.names, canonicalizeText) }
}

/**
 * Resolves a line's agent ids to the Agent objects they reference, in order with the lead first.
 * An id matching no agent is skipped, so a dangling reference drops out rather than leaving a hole.
 * An empty id never resolves, and the first agent claiming an id keeps it, matching what validate reports about both.
 */
export const resolveLineAgents = (line: { agents: string[] }, agents: Agent[]): Agent[] => {
  const idMap = new Map<string, Agent>()
  for (const agent of agents) {
    if (agent.id !== '' && !idMap.has(agent.id)) {
      idMap.set(agent.id, agent)
    }
  }
  return line.agents.map((id) => idMap.get(id)).filter((agent) => agent !== undefined)
}
