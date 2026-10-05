import type { MakeInit } from '@root/utils'
import type { Diagnostic } from '@root/common'
import type { Line, LineBackground, LineContent, Word } from './proto'

import { LineAnnotationSchema, LineType, PartSchema, Timing } from '@root/common/proto'
import { DiagnosticCode } from '@root/common'
import { LineBackgroundSchema, LineContentSchema, LineSchema, WordSchema } from './proto'

import {
  byTime,
  canonicalizeField,
  canonicalizeList,
  childPath,
  dropDefault,
  findDuplicates,
  getTimeRangeEnd,
  isTimeRangeOrdered,
  lowerTag,
} from '@root/utils'
import { canonicalizeLineAnnotation, validateContent, validateLineAnnotation, validatePart, validateTimeRange } from '@root/common'
import { canonicalizeWord } from './word'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a word-level LineContent from the words the line decomposes into.
 */
export const makeLineContentWords = (words: Word[]): LineContent => {
  return create(LineContentSchema, { words })
}

/**
 * Creates a line-level LineContent from the line's plain text.
 */
export const makeLineContentText = (text: string): LineContent => {
  return create(LineContentSchema, { text })
}

/**
 * Returns a canonical copy of the content with its words canonicalized; the plain text is left as is.
 */
export const canonicalizeLineContent = (content: LineContent): LineContent => {
  return { ...content, words: canonicalizeList(WordSchema, content.words, canonicalizeWord) }
}

/**
 * Creates a normal line, stamping LINE_TYPE_NORMAL so the discriminant can never be set from outside; its language tags are lowercased.
 */
export const makeLineNormal = (init: Omit<MakeInit<typeof LineSchema>, 'type'>): Line => {
  return create(LineSchema, {
    id: init.id,
    type: LineType.NORMAL,
    time: init.time,
    part: init.part,
    agents: init.agents,
    languages: init.languages?.map((tag) => tag.toLowerCase()),
    content: init.content,
    annotation: init.annotation,
    backgrounds: init.backgrounds,
  })
}

/**
 * Creates an instrumental line, stamping LINE_TYPE_INSTRUMENTAL and carrying no content, only a time range and optionally an id and a part.
 * A present part means the source stated the stretch; its absence means it was derived from a gap in the timeline.
 */
export const makeLineInstrumental = (init?: Pick<MakeInit<typeof LineSchema>, 'id' | 'time' | 'part'>): Line => {
  return create(LineSchema, { id: init?.id, time: init?.time, part: init?.part, type: LineType.INSTRUMENTAL })
}

/**
 * Creates a LineBackground, a background vocal line attached to a normal line; its language tags are lowercased.
 */
export const makeLineBackground = (init?: MakeInit<typeof LineBackgroundSchema>): LineBackground => {
  return create(LineBackgroundSchema, { ...init, languages: init?.languages?.map((tag) => tag.toLowerCase()) })
}

/**
 * Validates a Line: its kind must be resolved, a NORMAL line must carry content, an INSTRUMENTAL one must carry only a range that ends somewhere, and its time, part, content and background lines must each be valid.
 * `timing` is the lyric's declared precision, passed down to its words; what the timing itself demands needs the whole lyric and stays in `validateLyric`.
 */
export const validateLine = (line: Line, path = '', timing = Timing.UNSPECIFIED): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const instrumental = line.type === LineType.INSTRUMENTAL
  if (line.type === LineType.UNSPECIFIED) {
    diagnostics.push({ path: childPath(path, 'type'), code: DiagnosticCode.LineTypeUnspecified })
  }
  // An instrumental line is the stretch its range marks out, so it is nothing without a range, and nothing with one that never ends.
  if (line.time) {
    diagnostics.push(...validateTimeRange(line.time, childPath(path, 'time')))
    if (instrumental && line.time.end === undefined) {
      diagnostics.push({ path: childPath(path, 'time.end'), code: DiagnosticCode.LineTimeEndMissing })
    }
  } else if (instrumental) {
    diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LineTimeMissing })
  }
  if (line.part) {
    diagnostics.push(...validatePart(line.part, childPath(path, 'part')))
  }
  // An instrumental line carries no singing, so every field describing one is not allowed, and a forbidden field is never descended into.
  if (instrumental && line.agents.length > 0) {
    diagnostics.push({ path: childPath(path, 'agents'), code: DiagnosticCode.LineAgentsUnexpected })
  }
  if (instrumental && line.languages.length > 0) {
    diagnostics.push({ path: childPath(path, 'languages'), code: DiagnosticCode.LineLanguagesUnexpected })
  } else if (!instrumental) {
    findDuplicates(line.languages, (tag) => lowerTag(tag) ?? '').forEach((i) => {
      diagnostics.push({ path: childPath(path, `languages[${i}]`), code: DiagnosticCode.LineLanguagesDuplicate })
    })
  }
  if (line.type === LineType.NORMAL) {
    diagnostics.push(...validateContent(line.content, line.time, path, timing))
  } else if (line.content) {
    diagnostics.push({ path: childPath(path, 'content'), code: DiagnosticCode.LineContentUnexpected })
  }
  if (instrumental && line.annotation !== undefined) {
    diagnostics.push({ path: childPath(path, 'annotation'), code: DiagnosticCode.LineAnnotationUnexpected })
  } else if (line.annotation) {
    diagnostics.push(...validateLineAnnotation(line.annotation, childPath(path, 'annotation')))
  }
  if (instrumental && line.backgrounds.length > 0) {
    diagnostics.push({ path: childPath(path, 'backgrounds'), code: DiagnosticCode.LineBackgroundsUnexpected })
  } else {
    line.backgrounds.forEach((background, i) => {
      const backgroundPath = childPath(path, `backgrounds[${i}]`)
      // The parent's end covers a background line, while its start may precede the parent's; a range reported for its own numbers or order never joins this comparison.
      if (isTimeRangeOrdered(line.time) && isTimeRangeOrdered(background.time) && getTimeRangeEnd(background.time) > getTimeRangeEnd(line.time)) {
        diagnostics.push({ path: childPath(backgroundPath, 'time'), code: DiagnosticCode.LineBackgroundsTimeUncovered })
      }
      diagnostics.push(...validateLineBackground(background, backgroundPath, timing))
    })
  }
  return diagnostics
}

/**
 * Validates a LineBackground: it must carry content, and its time, content and annotation must each be valid.
 * `timing` is the lyric's declared precision, passed down to its words.
 */
export const validateLineBackground = (background: LineBackground, path = '', timing = Timing.UNSPECIFIED): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (background.time) {
    diagnostics.push(...validateTimeRange(background.time, childPath(path, 'time')))
  }
  findDuplicates(background.languages, (tag) => lowerTag(tag) ?? '').forEach((i) => {
    diagnostics.push({ path: childPath(path, `languages[${i}]`), code: DiagnosticCode.LineLanguagesDuplicate })
  })
  diagnostics.push(...validateContent(background.content, background.time, path, timing))
  if (background.annotation) {
    diagnostics.push(...validateLineAnnotation(background.annotation, childPath(path, 'annotation')))
  }
  return diagnostics
}

/**
 * Returns a copy of the line with its background lines ordered by start time ascending.
 */
export const orderLine = (line: Line): Line => {
  return { ...line, backgrounds: [...line.backgrounds].sort(byTime((background) => background.time)) }
}

/**
 * Returns a canonical copy of the background line: language tags lowercased, deduplicated and emptied out, content/annotation dropped when all-default, empty agent references dropped.
 */
export const canonicalizeLineBackground = (background: LineBackground): LineBackground => {
  return {
    ...background,
    agents: background.agents.filter((id) => id !== ''),
    languages: [...new Set(background.languages.map((tag) => tag.toLowerCase()).filter((tag) => tag !== ''))],
    content: canonicalizeField(LineContentSchema, background.content, canonicalizeLineContent),
    annotation: canonicalizeField(LineAnnotationSchema, background.annotation, canonicalizeLineAnnotation),
  }
}

/**
 * Returns a canonical copy of the line: language tags lowercased, deduplicated and emptied out, part/content/annotation dropped when all-default, empty agent references dropped, backgrounds canonicalized then ordered.
 */
export const canonicalizeLine = (line: Line): Line => {
  return {
    ...line,
    part: dropDefault(PartSchema, line.part),
    agents: line.agents.filter((id) => id !== ''),
    languages: [...new Set(line.languages.map((tag) => tag.toLowerCase()).filter((tag) => tag !== ''))],
    content: canonicalizeField(LineContentSchema, line.content, canonicalizeLineContent),
    annotation: canonicalizeField(LineAnnotationSchema, line.annotation, canonicalizeLineAnnotation),
    backgrounds: canonicalizeList(LineBackgroundSchema, line.backgrounds, canonicalizeLineBackground).sort(byTime((background) => background.time)),
  }
}
