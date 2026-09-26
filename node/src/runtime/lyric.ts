import type { MakeInit } from '@root/utils'
import type { Diagnostic } from '@root/common'
import type { Lyric } from './proto'

import { AgentSchema, MetaSchema, Timing } from '@root/common/proto'
import { DiagnosticCode } from '@root/common'
import { LanguageUsageSchema, LineSchema, LyricSchema, LyricStatus } from './proto'
import { SCHEMA_VERSION } from '@root/version'

import { SEMVER_PATTERN, byTime, canonicalizeField, canonicalizeList, childPath } from '@root/utils'
import { canonicalizeAgent, canonicalizeMeta, validateAgent, validateMetaCredit } from '@root/common'
import { canonicalizeLanguageUsage, orderLanguageUsages } from './language'
import { canonicalizeLine, orderLine, validateLine } from './line'

import { create, fromBinary, toBinary } from '@bufbuild/protobuf'

/**
 * Creates a runtime Lyric, stamping the current schema version over any version in init.
 * status must be VALID or INVALID; UNSPECIFIED is rejected at compile time, and the caller flips it as parsing resolves.
 */
export const makeLyric = (
  init: Omit<MakeInit<typeof LyricSchema>, 'version' | 'status'> & {
    status: LyricStatus.VALID | LyricStatus.INVALID
  },
): Lyric => {
  return create(LyricSchema, { ...init, version: SCHEMA_VERSION })
}

/**
 * Validates a runtime Lyric: the rules needing the whole tree in view, then recursing into agents, credits and lines.
 */
export const validateLyric = (lyric: Lyric): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []

  if (!SEMVER_PATTERN.test(lyric.version)) {
    diagnostics.push({ path: 'version', code: DiagnosticCode.LyricVersionMalformed })
  }

  const ids = new Set<string>()
  lyric.agents.forEach((agent, i) => {
    if (ids.has(agent.id)) {
      diagnostics.push({ path: `agents[${i}]`, code: DiagnosticCode.LyricAgentIdDuplicate })
    }
    // An empty id is reported by validateAgent and never resolves a reference.
    if (agent.id !== '') {
      ids.add(agent.id)
    }
    diagnostics.push(...validateAgent(agent, `agents[${i}]`))
  })

  if (lyric.meta) {
    lyric.meta.credits.forEach((credit, i) => diagnostics.push(...validateMetaCredit(credit, `meta.credits[${i}]`)))
  }

  const untimed = lyric.timing === Timing.NONE
  const lineIds = new Set<string>()
  /**
   * Reports a non-empty line id already taken by an earlier line or background line.
   */
  const claimLineId = (id: string, path: string): void => {
    if (id === '') {
      return
    }
    if (lineIds.has(id)) {
      diagnostics.push({ path, code: DiagnosticCode.LyricLineIdDuplicate })
    }
    lineIds.add(id)
  }
  lyric.lines.forEach((line, i) => {
    const path = `lines[${i}]`
    claimLineId(line.id, path)
    line.backgrounds.forEach((background, j) => claimLineId(background.id, `${path}.backgrounds[${j}]`))
    line.agents.forEach((id, j) => {
      if (!ids.has(id)) {
        diagnostics.push({ path: `${path}.agents[${j}]`, code: DiagnosticCode.LyricLineAgentDangling })
      }
    })
    if (untimed && line.time) {
      diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LyricTimingNonePresent })
    }
    if (untimed) {
      line.words.forEach((word, j) => {
        if (word.time) {
          diagnostics.push({ path: `${path}.words[${j}].time`, code: DiagnosticCode.LyricTimingNonePresent })
        }
      })
    }
    diagnostics.push(...validateLine(line, path))
  })

  return diagnostics
}

/**
 * Returns a copy of the lyric in canonical order: lines and their backgrounds by start time, languages by usage.
 */
export const orderLyric = (lyric: Lyric): Lyric => {
  return {
    ...lyric,
    languages: orderLanguageUsages(lyric.languages),
    lines: [...lyric.lines].sort(byTime((line) => line.time)).map(orderLine),
  }
}

/**
 * Returns a canonical copy of the runtime lyric: format lowercased, meta/agents/lines canonicalized, languages canonicalized then ordered, lines ordered.
 */
export const canonicalizeLyric = (lyric: Lyric): Lyric => {
  return {
    ...lyric,
    format: lyric.format.toLowerCase(),
    meta: canonicalizeField(MetaSchema, lyric.meta, canonicalizeMeta),
    languages: orderLanguageUsages(canonicalizeList(LanguageUsageSchema, lyric.languages, canonicalizeLanguageUsage)),
    agents: canonicalizeList(AgentSchema, lyric.agents, canonicalizeAgent),
    lines: canonicalizeList(LineSchema, lyric.lines, canonicalizeLine).sort(byTime((line) => line.time)),
  }
}

/**
 * Encodes a runtime Lyric to bytes.
 */
export const encode = (lyric: Lyric): Uint8Array => {
  return toBinary(LyricSchema, lyric)
}

/**
 * Decodes a runtime Lyric from bytes, keeping unknown fields so a round trip loses nothing.
 * It throws on malformed bytes and leaves the schema's rules to validateLyric.
 */
export const decode = (bytes: Uint8Array): Lyric => {
  return fromBinary(LyricSchema, bytes)
}
