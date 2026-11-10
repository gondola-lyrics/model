import type { MakeInit } from '@root/utils'
import type { Diagnostic, TimeRange } from '@root/common'
import type { LineContent, Lyric } from '@root/generated/storage/index.gen'

import { LineType, Timing } from '@root/generated/common/index.gen'
import { DiagnosticCode } from '@root/common'
import { SCHEMA_VERSION } from '@root/version'
import {
  SEMVER_PATTERN,
  byTime,
  canonicalizeField,
  canonicalizeList,
  childPath,
  findDefaultEntries,
  findUnordered,
  isUnresolved,
  withInit,
} from '@root/utils'
import { read, write } from '@root/utils/wire'
import { decodeStorageLyric, encodeStorageLyric } from '@root/generated/codec.gen'
import { createStorageLyric, fieldsCommonAgent, fieldsCommonMeta, fieldsStorageLine, fieldsStorageLyric } from '@root/generated/detail.gen'
import { canonicalizeAgent, canonicalizeMeta, validateAgent, validateMeta } from '@root/common'
import { validateLyricTags } from '@root/common/tag'

import { canonicalizeLine, orderLine, validateLine } from './line'

/**
 * Creates a storage Lyric, stamping the current schema version over any version in init.
 */
export const makeLyric = (init?: Omit<MakeInit<Lyric>, 'version'>): Lyric => {
  return withInit(createStorageLyric(), {
    version: SCHEMA_VERSION,
    format: init?.format,
    profile: init?.profile,
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

  // An unresolved precision leaves every timing rule with nothing to hold the lyric to, so a lyric that never stated one is reported rather than read as untimed.
  if (isUnresolved(Timing, lyric.timing)) {
    diagnostics.push({ path: 'timing', code: DiagnosticCode.LyricTimingUnspecified })
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

  // Every tag outside the lines is read here, since a line's own are read by validateLine, which knows the fields its kind forbids.
  diagnostics.push(...validateLyricTags(fieldsStorageLyric, lyric))

  const untimed = lyric.timing === Timing.NONE
  const lineTimed = lyric.timing === Timing.LINE
  const timed = lineTimed || lyric.timing === Timing.WORD
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
   * `forbidden` marks a node its parent's kind does not allow at all: what it carries is still held to the rules it breaks by carrying it, but nothing further is asked of it, since the node as a whole is already reported.
   * `open` marks a node whose range may stay open above: the last line, which nothing in the lyric bounds, and every background line, which the line it attaches to already bounds.
   */
  const checkReferences = (
    agents: string[],
    time: TimeRange | undefined,
    content: LineContent | undefined,
    path: string,
    type = LineType.NORMAL,
    forbidden = false,
    open = false,
  ): void => {
    const words = content?.words ?? []
    // A kind outside the enum turns out to need no range as readily as the zero value, so both are left unasked.
    const unresolvedType = isUnresolved(LineType, type)
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
      // Only a kind known to sing is asked for a range, since an unresolved one may turn out to need none, and a node that is not allowed in the first place is asked for nothing.
      if (timed && time === undefined && !unresolvedType && !forbidden) {
        diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LyricTimingLineTimeMissing })
      }
      // A sung line is shown for as long as its range runs, so the range has to end somewhere.
      if (timed && time !== undefined && time.end === undefined && !unresolvedType && !forbidden && !open) {
        diagnostics.push({ path: childPath(path, 'time.end'), code: DiagnosticCode.LyricLineTimeEndMissing })
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
    const forbidden = line.type === LineType.INSTRUMENTAL
    claimLineId(line.id, path)
    checkReferences(line.agents, line.time, line.content, path, line.type, false, i === lyric.lines.length - 1)
    line.backgrounds.forEach((background, j) => {
      const backgroundPath = `${path}.backgrounds[${j}]`
      claimLineId(background.id, backgroundPath)
      checkReferences(background.agents, background.time, background.content, backgroundPath, LineType.NORMAL, forbidden, true)
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
  findDefaultEntries(fieldsStorageLyric, lyric, covered).forEach((path) => {
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
 * Returns a canonical copy of the storage lyric: format and profile lowercased, meta/agents/lines canonicalized, lines ordered.
 * The copy shares no part of the tree with the lyric it was given, so editing either leaves the other as it was.
 */
export const canonicalizeLyric = (lyric: Lyric): Lyric => {
  return {
    ...lyric,
    format: lyric.format.toLowerCase(),
    profile: lyric.profile.toLowerCase(),
    meta: canonicalizeField(fieldsCommonMeta, lyric.meta, canonicalizeMeta),
    extra: { ...lyric.extra },
    agents: canonicalizeList(fieldsCommonAgent, lyric.agents, canonicalizeAgent),
    lines: canonicalizeList(fieldsStorageLine, lyric.lines, canonicalizeLine).sort(byTime((line) => line.time)),
  }
}

/**
 * Encodes a storage Lyric to bytes the official Protobuf libraries read.
 * It throws on a number its field cannot hold and on a string that is not well-formed UTF-16.
 */
export const encode = (lyric: Lyric): Uint8Array => {
  return write(encodeStorageLyric, lyric)
}

/**
 * Decodes a storage Lyric from bytes, dropping fields the schema does not define.
 * It throws on malformed bytes and leaves the schema's rules to validateLyric.
 */
export const decode = (bytes: Uint8Array): Lyric => {
  return read(createStorageLyric, decodeStorageLyric, bytes)
}
