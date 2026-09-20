import type { MakeInit } from '@root/utils'
import type { Diagnostic } from '@root/common'
import type { Line, LineBackground } from './proto'

import { LineAnnotationSchema, LineType, PartSchema, TimeSchema, WordSchema } from '@root/common/proto'
import { DiagnosticCode } from '@root/common'
import { LineBackgroundSchema, LineSchema } from './proto'

import { byTime, canonicalizeField, canonicalizeList, childPath, dropDefault } from '@root/utils'
import { canonicalizeLineAnnotation, canonicalizeWord, validatePart, validateTime, validateWord } from '@root/common'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a normal line, stamping LINE_TYPE_NORMAL so the discriminant can never be set from outside; its language tags are lowercased.
 */
export const makeLineNormal = (init: Omit<MakeInit<typeof LineSchema>, 'type'>): Line => {
  return create(LineSchema, { ...init, type: LineType.NORMAL, languages: init.languages?.map((tag) => tag.toLowerCase()) })
}

/**
 * Creates an instrumental line, stamping LINE_TYPE_INSTRUMENTAL and carrying only a time range and optional part.
 * A present part means the source stated the stretch; its absence means it was derived from a gap in the timeline.
 */
export const makeLineInstrumental = (init?: Pick<MakeInit<typeof LineSchema>, 'time' | 'part'>): Line => {
  return create(LineSchema, { ...init, type: LineType.INSTRUMENTAL })
}

/**
 * Creates a LineBackground, a background vocal line attached to a normal line; its language tags are lowercased.
 */
export const makeLineBackground = (init?: MakeInit<typeof LineBackgroundSchema>): LineBackground => {
  return create(LineBackgroundSchema, { ...init, languages: init?.languages?.map((tag) => tag.toLowerCase()) })
}

/**
 * Validates a Line: a NORMAL line must carry at least one word, and its Time, part and words must each be valid.
 */
export const validateLine = (line: Line, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (line.type === LineType.NORMAL && line.words.length === 0) {
    diagnostics.push({ path, code: DiagnosticCode.LineWordsEmpty })
  }
  if (line.time) {
    diagnostics.push(...validateTime(line.time, childPath(path, 'time')))
  }
  if (line.part) {
    diagnostics.push(...validatePart(line.part, childPath(path, 'part')))
  }
  line.words.forEach((word, i) => diagnostics.push(...validateWord(word, childPath(path, `words[${i}]`))))
  return diagnostics
}

/**
 * Returns a copy of the line with its background lines ordered by start time ascending.
 */
export const orderLine = (line: Line): Line => {
  return { ...line, backgrounds: [...line.backgrounds].sort(byTime((background) => background.time)) }
}

/**
 * Returns a canonical copy of the background line: language tags lowercased, time and annotation dropped when all-default, words canonicalized.
 */
export const canonicalizeLineBackground = (background: LineBackground): LineBackground => {
  return {
    ...background,
    time: dropDefault(TimeSchema, background.time),
    languages: background.languages.map((tag) => tag.toLowerCase()),
    words: canonicalizeList(WordSchema, background.words, canonicalizeWord),
    annotation: canonicalizeField(LineAnnotationSchema, background.annotation, canonicalizeLineAnnotation),
  }
}

/**
 * Returns a canonical copy of the line: language tags lowercased, time/part/annotation dropped when all-default, words canonicalized, backgrounds canonicalized then ordered.
 */
export const canonicalizeLine = (line: Line): Line => {
  return {
    ...line,
    time: dropDefault(TimeSchema, line.time),
    part: dropDefault(PartSchema, line.part),
    languages: line.languages.map((tag) => tag.toLowerCase()),
    words: canonicalizeList(WordSchema, line.words, canonicalizeWord),
    annotation: canonicalizeField(LineAnnotationSchema, line.annotation, canonicalizeLineAnnotation),
    backgrounds: canonicalizeList(LineBackgroundSchema, line.backgrounds, canonicalizeLineBackground).sort(byTime((background) => background.time)),
  }
}
