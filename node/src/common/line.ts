import type { MakeInit } from '@root/utils'
import type { LineAnnotation, LineAnnotationRoman, LineAnnotationTranslation, TimeRange } from './proto'
import type { AnyWord } from './word'
import type { Diagnostic } from './diagnostic'

import { LineAnnotationRomanSchema, LineAnnotationSchema, LineAnnotationTranslationSchema, WordType } from './proto'
import { DiagnosticCode } from './diagnostic'

import { canonicalizeList, childPath, lowerTag } from '@root/utils'
import { getAnnotationItemText, getWordsText, validateWords } from './word'

import { create } from '@bufbuild/protobuf'

/**
 * The fields every layer's line content shares, so helpers that only read them work on either layer.
 */
export type AnyLineContent = {
  words: AnyWord[]
  text?: string
}

/**
 * Validates a normal line's or background line's content: exactly one of `words` or `text` must be set, and its words must be valid.
 */
export const validateContent = (content: AnyLineContent | undefined, time: TimeRange | undefined, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const contentPath = childPath(path, 'content')
  const hasWords = content !== undefined && content.words.length > 0
  const hasText = content?.text !== undefined
  if (!hasWords && !hasText) {
    diagnostics.push({ path, code: DiagnosticCode.LineContentMissing })
  } else if (hasWords && hasText) {
    diagnostics.push({ path: contentPath, code: DiagnosticCode.LineContentAmbiguous })
  }
  diagnostics.push(...validateWords(content?.words ?? [], time, contentPath))
  return diagnostics
}

/**
 * Returns a line's text: its plain text when it carries that, otherwise its words joined.
 */
export const getContentText = (content: AnyLineContent | undefined): string => {
  return content?.text ?? getWordsText(content?.words ?? [])
}

/**
 * Reports whether a line is word-level, i.e. its content carries words rather than plain text; an instrumental or text line is not.
 */
export const isSyllableLine = (line: { content?: AnyLineContent }): boolean => {
  return (line.content?.words.length ?? 0) > 0
}

/**
 * Creates a LineAnnotation, the per-line annotation container.
 */
export const makeLineAnnotation = (init?: MakeInit<typeof LineAnnotationSchema>): LineAnnotation => {
  return create(LineAnnotationSchema, init)
}

/**
 * Creates a LineAnnotationRoman, a romanized transliteration of a whole line; its language tag is lowercased.
 */
export const makeLineAnnotationRoman = (init?: MakeInit<typeof LineAnnotationRomanSchema>): LineAnnotationRoman => {
  return create(LineAnnotationRomanSchema, { ...init, language: init?.language?.toLowerCase() })
}

/**
 * Creates a LineAnnotationTranslation, a translation of a whole line; its language tag is lowercased.
 */
export const makeLineAnnotationTranslation = (init?: MakeInit<typeof LineAnnotationTranslationSchema>): LineAnnotationTranslation => {
  return create(LineAnnotationTranslationSchema, { ...init, language: init?.language?.toLowerCase() })
}

/**
 * Returns a copy of the roman annotation with its language lowercased.
 */
export const canonicalizeLineAnnotationRoman = (roman: LineAnnotationRoman): LineAnnotationRoman => {
  return { ...roman, language: lowerTag(roman.language) }
}

/**
 * Returns a copy of the translation annotation with its language lowercased.
 */
export const canonicalizeLineAnnotationTranslation = (translation: LineAnnotationTranslation): LineAnnotationTranslation => {
  return { ...translation, language: lowerTag(translation.language) }
}

/**
 * Returns a copy of the annotation with both its lists canonicalized and all-default entries dropped.
 */
export const canonicalizeLineAnnotation = (annotation: LineAnnotation): LineAnnotation => {
  return {
    ...annotation,
    romans: canonicalizeList(LineAnnotationRomanSchema, annotation.romans, canonicalizeLineAnnotationRoman),
    translations: canonicalizeList(LineAnnotationTranslationSchema, annotation.translations, canonicalizeLineAnnotationTranslation),
  }
}

/**
 * Derives line-level romans from the content's words, one per language in order of first appearance; the result is for display and must never be stored on the line.
 * Words lacking a roman in that language are skipped, and any spaces between two romanized words collapse to a single U+0020.
 */
export const deriveLineRomans = (content: AnyLineContent | undefined): LineAnnotationRoman[] => {
  const words = content?.words ?? []
  const languages = new Set(words.flatMap((word) => word.annotation?.romans.map((roman) => lowerTag(roman.language)) ?? []))
  const romans: LineAnnotationRoman[] = []
  for (const language of languages) {
    let joined = ''
    let spaced = false
    for (const word of words) {
      if (word.type === WordType.SPACE) {
        spaced = true
        continue
      }
      const roman = word.annotation?.romans.find((item) => lowerTag(item.language) === language)
      const text = roman ? getAnnotationItemText(roman) : ''
      if (text !== '') {
        joined += joined !== '' && spaced ? ` ${text}` : text
        spaced = false
      }
    }
    if (joined !== '') {
      romans.push(makeLineAnnotationRoman({ language, text: joined }))
    }
  }
  return romans
}
