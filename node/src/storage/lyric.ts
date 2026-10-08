import type { MakeInit } from '@root/utils'
import type { Diagnostic, TimeRange } from '@root/common'
import type { LineContent, Lyric } from './proto'

import { AgentSchema, LineType, MetaSchema, Timing } from '@root/common/proto'
import { DiagnosticCode } from '@root/common'
import { LineSchema, LyricSchema } from './proto'
import { SCHEMA_VERSION } from '@root/version'

import { SEMVER_PATTERN, byTime, canonicalizeField, canonicalizeList, childPath, findDefaultEntries, findUnordered } from '@root/utils'
import { canonicalizeAgent, canonicalizeMeta, validateAgent, validateMeta } from '@root/common'
import { canonicalizeLine, orderLine, validateLine } from './line'

import { create, fromBinary, toBinary } from '@bufbuild/protobuf'

/**
 * Creates a storage Lyric, stamping the current schema version over any version in init.
 */
export const makeLyric = (init?: Omit<MakeInit<typeof LyricSchema>, 'version'>): Lyric => {
  return create(LyricSchema, {
    version: SCHEMA_VERSION,
    format: init?.format,
    timing: init?.timing,
    meta: init?.meta,
    extra: init?.extra,
    agents: init?.agents,
    lines: init?.lines,
  })
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
    // An empty id is reported by validateAgent and never resolves a reference.
    if (agent.id !== '') {
      ids.add(agent.id)
    }
    diagnostics.push(...validateAgent(agent, `agents[${i}]`))
  })

  if (lyric.meta) {
    diagnostics.push(...validateMeta(lyric.meta, 'meta'))
  }

  const untimed = lyric.timing === Timing.NONE
  const lineTimed = lyric.timing === Timing.LINE
  let anyContent = false
  let anyWords = false
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
  /**
   * Reports the whole-tree rules for one line or background line: agent references resolving to no agent, and whatever the declared timing asks of it.
   * It walks every node whatever the line's kind, since a whole-tree invariant holds regardless; an instrumental line's agents and own range validateLine already rules on, and a background line is read as the sung line it always is.
   */
  const checkReferences = (
    agents: string[],
    time: TimeRange | undefined,
    content: LineContent | undefined,
    path: string,
    type = LineType.NORMAL,
  ): void => {
    const words = content?.words ?? []
    const sung = type !== LineType.INSTRUMENTAL
    if (sung) {
      agents.forEach((id, j) => {
        if (!ids.has(id)) {
          diagnostics.push({ path: `${path}.agents[${j}]`, code: DiagnosticCode.LyricLineAgentDangling })
        }
      })
      anyWords = anyWords || words.length > 0
      anyContent = anyContent || words.length > 0 || content?.text !== undefined
      // Line-level timing sits on the line itself, so a sung line needs its own range and may not be split into words.
      if (lineTimed && words.length > 0) {
        diagnostics.push({ path: `${path}.content.words`, code: DiagnosticCode.LyricTimingLineWords })
      }
      // Only a kind known to sing is asked for a range, since an unresolved one may turn out to need none.
      if (lineTimed && time === undefined && type !== LineType.UNSPECIFIED) {
        diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LyricTimingLineTimeMissing })
      }
    } else if (untimed) {
      // An untimed lyric marks out no stretches, so it carries no instrumental line at all.
      diagnostics.push({ path: childPath(path, 'type'), code: DiagnosticCode.LyricTimingNoneInstrumental })
    }
    if (untimed && time) {
      diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LyricTimingNonePresent })
    }
    if (untimed && words.length > 0) {
      diagnostics.push({ path: `${path}.content.words`, code: DiagnosticCode.LyricTimingNoneWords })
    }
    if (untimed) {
      words.forEach((word, j) => {
        if (word.time) {
          diagnostics.push({ path: `${path}.content.words[${j}].time`, code: DiagnosticCode.LyricTimingNonePresent })
        }
      })
    }
  }
  lyric.lines.forEach((line, i) => {
    const path = `lines[${i}]`
    claimLineId(line.id, path)
    checkReferences(line.agents, line.time, line.content, path, line.type)
    line.backgrounds.forEach((background, j) => {
      const backgroundPath = `${path}.backgrounds[${j}]`
      claimLineId(background.id, backgroundPath)
      checkReferences(background.agents, background.time, background.content, backgroundPath)
    })
    diagnostics.push(...validateLine(line, path, lyric.timing))
  })
  // Word-level timing needs only one line split into words, since a word-level source may leave the rest whole; a lyric with no content at all declares nothing to check.
  if (lyric.timing === Timing.WORD && anyContent && !anyWords) {
    diagnostics.push({ path: 'timing', code: DiagnosticCode.LyricTimingWordMissing })
  }
  // The schema declares the list ordered, so a line starting before the one it follows is out of place.
  findUnordered(lyric.lines, (line) => line.time).forEach((i) => {
    diagnostics.push({ path: `lines[${i}]`, code: DiagnosticCode.LyricLinesUnordered })
  })
  // A rule that already spoke about a path keeps the sweep off it, and validateAgent reports an all-default agent at the agent rather than inside it.
  const covered = diagnostics.map((diagnostic) => diagnostic.path)
  lyric.agents.forEach((agent, i) => covered.push(`agents[${i}]`))
  findDefaultEntries(LyricSchema, lyric, covered).forEach((path) => {
    diagnostics.push({ path, code: DiagnosticCode.LyricListEntryEmpty })
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
