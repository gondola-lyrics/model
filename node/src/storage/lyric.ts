import type { MakeInit } from '@root/utils'
import type { Diagnostic } from '@root/common'
import type { Lyric } from './proto'

import { AgentSchema, MetaSchema, Timing } from '@root/common/proto'
import { DiagnosticCode } from '@root/common'
import { LineSchema, LyricSchema } from './proto'
import { SCHEMA_VERSION } from '@root/version'

import { SEMVER_PATTERN, byTime, canonicalizeField, canonicalizeList, childPath } from '@root/utils'
import { canonicalizeAgent, canonicalizeMeta, validateAgent, validateMetaCredit } from '@root/common'
import { canonicalizeLine, orderLine, validateLine } from './line'

import { create, fromBinary, toBinary } from '@bufbuild/protobuf'

/**
 * Creates a storage Lyric, stamping the current schema version over any version in init.
 */
export const makeLyric = (init?: Omit<MakeInit<typeof LyricSchema>, 'version'>): Lyric => {
  return create(LyricSchema, { ...init, version: SCHEMA_VERSION })
}

/**
 * Validates a storage Lyric: the rules needing the whole tree in view, then recursing into agents, credits and lines.
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
    ids.add(agent.id)
    diagnostics.push(...validateAgent(agent, `agents[${i}]`))
  })

  if (lyric.meta) {
    lyric.meta.credits.forEach((credit, i) => diagnostics.push(...validateMetaCredit(credit, `meta.credits[${i}]`)))
  }

  const untimed = lyric.timing === Timing.NONE
  lyric.lines.forEach((line, i) => {
    const path = `lines[${i}]`
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
 * Returns a copy of the lyric in canonical order: lines and their backgrounds by start time.
 */
export const orderLyric = (lyric: Lyric): Lyric => {
  return {
    ...lyric,
    lines: [...lyric.lines].sort(byTime((line) => line.time)).map(orderLine),
  }
}

/**
 * Returns a canonical copy of the storage lyric: format lowercased, meta/agents/lines canonicalized, lines ordered.
 */
export const canonicalizeLyric = (lyric: Lyric): Lyric => {
  return {
    ...lyric,
    format: lyric.format.toLowerCase(),
    meta: canonicalizeField(MetaSchema, lyric.meta, canonicalizeMeta),
    agents: canonicalizeList(AgentSchema, lyric.agents, canonicalizeAgent),
    lines: canonicalizeList(LineSchema, lyric.lines, canonicalizeLine).sort(byTime((line) => line.time)),
  }
}

/**
 * Encodes a storage Lyric to bytes.
 */
export const encode = (lyric: Lyric): Uint8Array => {
  return toBinary(LyricSchema, lyric)
}

/**
 * Decodes a storage Lyric from bytes, keeping unknown fields so a round trip loses nothing.
 * It throws on malformed bytes and leaves the schema's rules to validateLyric.
 */
export const decode = (bytes: Uint8Array): Lyric => {
  return fromBinary(LyricSchema, bytes)
}
