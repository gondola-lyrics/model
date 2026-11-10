import type { MakeInit } from '@root/utils'
import type { Diagnostic } from '@root/common'
import type { Line, LineBackground, LineContent, Word } from '@root/generated/storage/index.gen'

import { LineType, Timing } from '@root/generated/common/index.gen'
import { DiagnosticCode } from '@root/common'

import {
  byTime,
  canonicalizeField,
  canonicalizeList,
  childPath,
  copyMessage,
  dropDefault,
  findDuplicates,
  findUnordered,
  getTimeRangeEnd,
  isTimeRangeOrdered,
  isUnresolved,
  lowerTag,
  withInit,
} from '@root/utils'
import {
  createStorageLine,
  createStorageLineBackground,
  createStorageLineContent,
  fieldsCommonLineAnnotation,
  fieldsCommonPart,
  fieldsStorageLine,
  fieldsStorageLineBackground,
  fieldsStorageLineContent,
  fieldsStorageWord,
} from '@root/generated/internal.gen'
import { canonicalizeLineAnnotation, validateContent, validateLineAnnotation, validatePart, validateTimeRange } from '@root/common'
import { validateLineTags } from '@root/common/tag'
import { canonicalizeWord } from './word'

/**
 * Creates a word-level LineContent from the words the line decomposes into.
 */
export const makeLineContentWords = (words: Word[]): LineContent => {
  return withInit(createStorageLineContent(), { words })
}

/**
 * Creates a line-level LineContent from the line's plain text.
 */
export const makeLineContentText = (text: string): LineContent => {
  return withInit(createStorageLineContent(), { text })
}

/**
 * Returns a canonical copy of the content with its words canonicalized; the plain text is left as is.
 */
export const canonicalizeLineContent = (content: LineContent): LineContent => {
  return { ...content, words: canonicalizeList(fieldsStorageWord, content.words, canonicalizeWord) }
}

/**
 * Creates a normal line, stamping LINE_TYPE_NORMAL so the discriminant can never be set from outside.
 */
export const makeLineNormal = (init?: Omit<MakeInit<Line>, 'type'>): Line => {
  return withInit(createStorageLine(), {
    id: init?.id,
    type: LineType.NORMAL,
    time: init?.time,
    part: init?.part,
    agents: init?.agents,
    languages: init?.languages,
    content: init?.content,
    annotation: init?.annotation,
    backgrounds: init?.backgrounds,
  })
}

/**
 * Creates an instrumental line, stamping LINE_TYPE_INSTRUMENTAL and carrying no content, only a time range and optionally an id and a part.
 * A present part means the source stated the stretch; its absence means it was derived from a gap in the timeline.
 */
export const makeLineInstrumental = (init?: Pick<MakeInit<Line>, 'id' | 'time' | 'part'>): Line => {
  return withInit(createStorageLine(), { id: init?.id, time: init?.time, part: init?.part, type: LineType.INSTRUMENTAL })
}

/**
 * Creates a LineBackground, a background vocal line attached to a normal line.
 */
export const makeLineBackground = (init?: MakeInit<LineBackground>): LineBackground => {
  return withInit(createStorageLineBackground(), init)
}

/**
 * Validates a Line: its kind must be resolved, a NORMAL line must carry content, an INSTRUMENTAL one must carry only a range that ends somewhere, and its time, part, content and background lines must each be valid.
 * An unresolved kind is asked for no content and forbidden none, though whatever content it carries is still checked.
 * `timing` is the lyric's declared precision, passed down to its words; an untimed lyric asks an instrumental line for no range, since `validateLyric` reports the line itself instead.
 */
export const validateLine = (line: Line, path = '', timing = Timing.UNSPECIFIED): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  // Tags are read here rather than by the lyric, since only this knows which fields a line's kind forbids, and a forbidden field is never descended into.
  if (line.type !== LineType.INSTRUMENTAL) {
    diagnostics.push(...validateLineTags(fieldsStorageLine, line, path))
  }
  const instrumental = line.type === LineType.INSTRUMENTAL
  // A kind outside the enum reads as unresolved too, since a value this schema does not know cannot be held to any of its kind's rules.
  if (isUnresolved(LineType, line.type)) {
    diagnostics.push({ path: childPath(path, 'type'), code: DiagnosticCode.LineTypeUnspecified })
  }
  // An instrumental line is the stretch its range marks out, so it is nothing without a range, and nothing with one that never ends or one that ends where it starts.
  // An untimed lyric marks out no stretches, so there the lyric reports the line itself and asks for no range here.
  const needsRange = instrumental && timing !== Timing.NONE
  if (line.time) {
    diagnostics.push(...validateTimeRange(line.time, childPath(path, 'time')))
    if (needsRange && line.time.end === undefined) {
      diagnostics.push({ path: childPath(path, 'time.end'), code: DiagnosticCode.LineTimeEndMissing })
    }
    // Only a range running the right way makes its bounds worth comparing, so a range already reported for its own numbers is left alone here.
    if (needsRange && isTimeRangeOrdered(line.time) && line.time.end === line.time.start) {
      diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LineTimeEmpty })
    }
  } else if (needsRange) {
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
  // Content belongs to a sung line, so an instrumental one may carry none, while an unresolved kind is asked for none and forbidden none.
  if (instrumental) {
    if (line.content) {
      diagnostics.push({ path: childPath(path, 'content'), code: DiagnosticCode.LineContentUnexpected })
    }
  } else {
    diagnostics.push(...validateContent(line.content, line.time, path, timing, line.type === LineType.NORMAL))
  }
  if (instrumental && line.annotation !== undefined) {
    diagnostics.push({ path: childPath(path, 'annotation'), code: DiagnosticCode.LineAnnotationUnexpected })
  } else if (line.annotation) {
    diagnostics.push(...validateLineAnnotation(line.annotation, childPath(path, 'annotation')))
  }
  if (instrumental && line.backgrounds.length > 0) {
    diagnostics.push({ path: childPath(path, 'backgrounds'), code: DiagnosticCode.LineBackgroundsUnexpected })
  } else {
    // The schema declares the list ordered, so an entry starting before the one it follows is out of place.
    findUnordered(line.backgrounds, (background) => background.time).forEach((i) => {
      diagnostics.push({ path: childPath(path, `backgrounds[${i}]`), code: DiagnosticCode.LineBackgroundsUnordered })
    })
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
    time: copyMessage(background.time),
    agents: background.agents.filter((id) => id !== ''),
    languages: [...new Set(background.languages.map((tag) => tag.toLowerCase()).filter((tag) => tag !== ''))],
    content: canonicalizeField(fieldsStorageLineContent, background.content, canonicalizeLineContent),
    annotation: canonicalizeField(fieldsCommonLineAnnotation, background.annotation, canonicalizeLineAnnotation),
  }
}

/**
 * Returns a canonical copy of the line: language tags lowercased, deduplicated and emptied out, part/content/annotation dropped when all-default, empty agent references dropped, backgrounds canonicalized then ordered.
 */
export const canonicalizeLine = (line: Line): Line => {
  return {
    ...line,
    time: copyMessage(line.time),
    part: dropDefault(fieldsCommonPart, copyMessage(line.part)),
    agents: line.agents.filter((id) => id !== ''),
    languages: [...new Set(line.languages.map((tag) => tag.toLowerCase()).filter((tag) => tag !== ''))],
    content: canonicalizeField(fieldsStorageLineContent, line.content, canonicalizeLineContent),
    annotation: canonicalizeField(fieldsCommonLineAnnotation, line.annotation, canonicalizeLineAnnotation),
    backgrounds: canonicalizeList(fieldsStorageLineBackground, line.backgrounds, canonicalizeLineBackground).sort(
      byTime((background) => background.time),
    ),
  }
}
