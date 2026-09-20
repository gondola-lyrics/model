import type { MakeInit } from '@root/utils'
import type { Diagnostic } from '@root/common'
import type { Lyric } from './proto'

import { Timing } from '@root/common/proto'
import { DiagnosticCode } from '@root/common'
import { LyricSchema, LyricStatus } from './proto'
import { SCHEMA_VERSION } from '@root/version'

import { SEMVER_PATTERN, byTime, childPath } from '@root/utils'
import { validateAgent, validateMetaCredit } from '@root/common'
import { orderLanguageUsages } from './language'
import { orderLine, validateLine } from './line'

import { create } from '@bufbuild/protobuf'

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
 * Returns a copy of the lyric in canonical order: lines and their backgrounds by start time, languages by usage.
 */
export const orderLyric = (lyric: Lyric): Lyric => {
  return {
    ...lyric,
    languages: orderLanguageUsages(lyric.languages),
    lines: [...lyric.lines].sort(byTime((line) => line.time)).map(orderLine),
  }
}
