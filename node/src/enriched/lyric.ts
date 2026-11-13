import type { Diagnostic, TimeRange } from '@root/common'
import type { MakeInit } from '@root/utils'
import type { LineContent, Lyric } from '@root/generated/enriched/index.gen'

import { DiagnosticCode, canonicalizeAgent, canonicalizeMeta, validateAgent, validateMeta } from '@root/common'
import { validateLyricParts } from '@root/common/part'
import { validateLyricTags } from '@root/common/tag'
import { decodeEnrichedLyric as decodeEnrichedLyricMessage, encodeEnrichedLyric as encodeEnrichedLyricMessage } from '@root/generated/codec.gen'
import { TimingLevel } from '@root/generated/common/index.gen'
import { createEnrichedLyric, fieldsCommonAgent, fieldsCommonMeta, fieldsEnrichedLine, fieldsEnrichedLyric } from '@root/generated/detail.gen'
import { LineType, LyricStatus } from '@root/generated/enriched/index.gen'
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
import { SCHEMA_VERSION } from '@root/version'

import {
  canonicalizeEnrichedLanguageUsages,
  deriveEnrichedLanguageUsages,
  orderEnrichedLanguageUsages,
  validateEnrichedLanguageUsage,
} from './language'
import { canonicalizeEnrichedLine, orderEnrichedLine, validateEnrichedLine } from './line'

/**
 * Creates a lyric with the current schema version.
 */
export const makeEnrichedLyric = (
  init: Omit<MakeInit<Lyric>, 'version' | 'status'> & {
    status: LyricStatus.VALID | LyricStatus.INVALID
  },
): Lyric => {
  return withInit(createEnrichedLyric(), {
    status: init.status,
    version: SCHEMA_VERSION,
    format: init.format,
    profile: init.profile,
    timing: init.timing,
    meta: init.meta,
    agents: init.agents,
    lines: init.lines,
    languageUsages: init.languageUsages,
    extra: init.extra,
  })
}

/**
 * Checks document-wide constraints and validates agents, metadata, and lines.
 */
export const validateEnrichedLyric = (lyric: Lyric): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []

  if (!SEMVER_PATTERN.test(lyric.version)) {
    diagnostics.push({ path: 'version', code: DiagnosticCode.LyricVersionMalformed })
  }

  if (lyric.status === LyricStatus.UNSPECIFIED) {
    diagnostics.push({ path: 'status', code: DiagnosticCode.LyricStatusUnspecified })
  }

  // An unresolved timing level leaves every timing rule with nothing to hold the lyric to, so a lyric that never stated one is reported rather than read as untimed.
  if (isUnresolved(TimingLevel, lyric.timing)) {
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

  // Every tag outside the lines is read here, since a line's own are read by validateEnrichedLine, which knows the fields its kind forbids.
  diagnostics.push(...validateLyricTags(fieldsEnrichedLyric, lyric))

  const languageTags = new Set<string>()
  lyric.languageUsages.forEach((usage, i) => {
    const path = `languageUsages[${i}]`
    const tag = usage.tag.toLowerCase()
    if (languageTags.has(tag)) {
      diagnostics.push({ path, code: DiagnosticCode.LyricLanguageUsagesTagDuplicate })
    }
    languageTags.add(tag)
    diagnostics.push(...validateEnrichedLanguageUsage(usage, path))
  })

  // The usages are derived from the lines, so the stored list must be exactly what deriving them yields, order included.
  const derived = deriveEnrichedLanguageUsages(lyric.lines)
  const sameLanguageUsages =
    lyric.languageUsages.length === derived.length &&
    lyric.languageUsages.every((usage, i) => usage.tag === derived[i]?.tag && usage.lineCount === derived[i]?.lineCount)
  if (!sameLanguageUsages) {
    diagnostics.push({ path: 'languageUsages', code: DiagnosticCode.LyricLanguageUsagesMismatch })
  }

  const untimed = lyric.timing === TimingLevel.NONE
  const lineTimed = lyric.timing === TimingLevel.LINE
  const timed = lineTimed || lyric.timing === TimingLevel.WORD
  let anyContent = false
  let anyWords = false
  const lineIds = new Set<string>()
  /**
   * Reports a non-empty id already used by a line or background.
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
   * Checks agent references and timing requirements for a line or background.
   *
   * Forbidden nodes and unresolved kinds require no additional fields; open nodes may omit their end.
   */
  const checkReferences = (
    agentIds: string[],
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
      agentIds.forEach((id, j) => {
        if (!ids.has(id)) {
          diagnostics.push({ path: `${path}.agentIds[${j}]`, code: DiagnosticCode.LyricLineAgentDangling })
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
    checkReferences(line.agentIds, line.time, line.content, path, line.type, false, i === lyric.lines.length - 1)
    line.backgrounds.forEach((background, j) => {
      const backgroundPath = `${path}.backgrounds[${j}]`
      claimLineId(background.id, backgroundPath)
      checkReferences(background.agentIds, background.time, background.content, backgroundPath, LineType.NORMAL, forbidden, true)
    })
    diagnostics.push(...validateEnrichedLine(line, path, lyric.timing))
  })
  // Word-level timing needs only one line split into words, since a word-level source may leave the rest whole; a lyric with no content at all declares nothing to check.
  if (lyric.timing === TimingLevel.WORD && anyContent && !anyWords) {
    diagnostics.push({ path: 'timing', code: DiagnosticCode.LyricTimingWordMissing })
  }
  // The schema declares the list ordered, so a line starting before the one it follows is out of place.
  findUnordered(lyric.lines, (line) => line.time).forEach((i) => {
    diagnostics.push({ path: `lines[${i}]`, code: DiagnosticCode.LyricLinesUnordered })
  })
  diagnostics.push(
    ...validateLyricParts(
      lyric.lines.map((line) => line.part),
      lyric.lines.findLastIndex((line) => line.type === LineType.NORMAL),
    ),
  )
  // A rule that already spoke about a path keeps the sweep off it, and validateAgent reports an all-default agent at the agent rather than inside it.
  const covered = diagnostics.map((diagnostic) => diagnostic.path)
  lyric.agents.forEach((agent, i) => covered.push(`agents[${i}]`))
  findDefaultEntries(fieldsEnrichedLyric, lyric, covered).forEach((path) => {
    diagnostics.push({ path, code: DiagnosticCode.LyricListEntryEmpty })
  })

  return diagnostics
}

/**
 * Orders lines and backgrounds stably by start time and language usages by count and tag.
 */
export const orderEnrichedLyric = (lyric: Lyric): Lyric => {
  return {
    ...lyric,
    lines: [...lyric.lines].sort(byTime((line) => line.time)).map(orderEnrichedLine),
    languageUsages: orderEnrichedLanguageUsages(lyric.languageUsages),
  }
}

/**
 * Returns a canonical copy with normalized fields and ordered collections.
 *
 * No mutable object or array is shared with the input.
 */
export const canonicalizeEnrichedLyric = (lyric: Lyric): Lyric => {
  return {
    ...lyric,
    format: lyric.format.toLowerCase(),
    profile: lyric.profile.toLowerCase(),
    meta: canonicalizeField(fieldsCommonMeta, lyric.meta, canonicalizeMeta),
    agents: canonicalizeList(fieldsCommonAgent, lyric.agents, canonicalizeAgent),
    lines: canonicalizeList(fieldsEnrichedLine, lyric.lines, canonicalizeEnrichedLine).sort(byTime((line) => line.time)),
    languageUsages: canonicalizeEnrichedLanguageUsages(lyric.languageUsages),
    extra: { ...lyric.extra },
  }
}

/**
 * Encodes a lyric using the Protobuf wire format.
 *
 * Throws on out-of-range numbers and malformed UTF-16 strings.
 */
export const encodeEnrichedLyric = (lyric: Lyric): Uint8Array => {
  return write(encodeEnrichedLyricMessage, lyric)
}

/**
 * Decodes a lyric, discarding unknown fields.
 *
 * Throws on malformed bytes; semantic constraints are checked by validateEnrichedLyric.
 */
export const decodeEnrichedLyric = (bytes: Uint8Array): Lyric => {
  return read(createEnrichedLyric, decodeEnrichedLyricMessage, bytes)
}
