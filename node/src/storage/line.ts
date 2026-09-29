import type { MakeInit } from '@root/utils'
import type { Diagnostic } from '@root/common'
import type { Line, LineBackground, LineContent, Word } from './proto'

import { LineAnnotationSchema, LineType, PartSchema, TimeRangeSchema } from '@root/common/proto'
import { DiagnosticCode } from '@root/common'
import { LineBackgroundSchema, LineContentSchema, LineSchema, WordSchema } from './proto'

import { byTime, canonicalizeField, canonicalizeList, childPath, dropDefault } from '@root/utils'
import { canonicalizeLineAnnotation, validateContent, validatePart, validateTimeRange } from '@root/common'
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
 * Creates a normal line, stamping LINE_TYPE_NORMAL so the discriminant can never be set from outside.
 */
export const makeLineNormal = (init: Omit<MakeInit<typeof LineSchema>, 'type'>): Line => {
  return create(LineSchema, { ...init, type: LineType.NORMAL })
}

/**
 * Creates an instrumental line, stamping LINE_TYPE_INSTRUMENTAL and carrying no content, only a time range and optionally an id and a part.
 * A present part means the source stated the stretch; its absence means it was derived from a gap in the timeline.
 */
export const makeLineInstrumental = (init?: Pick<MakeInit<typeof LineSchema>, 'id' | 'time' | 'part'>): Line => {
  return create(LineSchema, { ...init, type: LineType.INSTRUMENTAL })
}

/**
 * Creates a LineBackground, a background vocal line attached to a normal line.
 */
export const makeLineBackground = (init?: MakeInit<typeof LineBackgroundSchema>): LineBackground => {
  return create(LineBackgroundSchema, init)
}

/**
 * Validates a Line: a NORMAL line must carry content and any other kind must not, and its time, part, content and background lines must each be valid.
 */
export const validateLine = (line: Line, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (line.time) {
    diagnostics.push(...validateTimeRange(line.time, childPath(path, 'time')))
  }
  if (line.part) {
    diagnostics.push(...validatePart(line.part, childPath(path, 'part')))
  }
  if (line.type === LineType.NORMAL) {
    diagnostics.push(...validateContent(line.content, line.time, path))
  } else if (line.content) {
    diagnostics.push({ path: childPath(path, 'content'), code: DiagnosticCode.LineContentUnexpected })
  }
  line.backgrounds.forEach((background, i) => diagnostics.push(...validateLineBackground(background, childPath(path, `backgrounds[${i}]`))))
  return diagnostics
}

/**
 * Validates a LineBackground: it must carry content, and its time and content must each be valid.
 */
export const validateLineBackground = (background: LineBackground, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (background.time) {
    diagnostics.push(...validateTimeRange(background.time, childPath(path, 'time')))
  }
  diagnostics.push(...validateContent(background.content, background.time, path))
  return diagnostics
}

/**
 * Returns a copy of the line with its background lines ordered by start time ascending.
 */
export const orderLine = (line: Line): Line => {
  return { ...line, backgrounds: [...line.backgrounds].sort(byTime((background) => background.time)) }
}

/**
 * Returns a canonical copy of the background line: time/content/annotation dropped when all-default, empty agent references dropped.
 */
export const canonicalizeLineBackground = (background: LineBackground): LineBackground => {
  return {
    ...background,
    time: dropDefault(TimeRangeSchema, background.time),
    agents: background.agents.filter((id) => id !== ''),
    content: canonicalizeField(LineContentSchema, background.content, canonicalizeLineContent),
    annotation: canonicalizeField(LineAnnotationSchema, background.annotation, canonicalizeLineAnnotation),
  }
}

/**
 * Returns a canonical copy of the line: time/part/content/annotation dropped when all-default, empty agent references dropped, backgrounds canonicalized then ordered.
 */
export const canonicalizeLine = (line: Line): Line => {
  return {
    ...line,
    time: dropDefault(TimeRangeSchema, line.time),
    part: dropDefault(PartSchema, line.part),
    agents: line.agents.filter((id) => id !== ''),
    content: canonicalizeField(LineContentSchema, line.content, canonicalizeLineContent),
    annotation: canonicalizeField(LineAnnotationSchema, line.annotation, canonicalizeLineAnnotation),
    backgrounds: canonicalizeList(LineBackgroundSchema, line.backgrounds, canonicalizeLineBackground).sort(byTime((background) => background.time)),
  }
}
