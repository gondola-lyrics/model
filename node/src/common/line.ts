import type { MakeInit } from '@root/utils'
import type { LineAnnotation, LineAnnotationRoman, LineAnnotationTranslation, TimeRange } from './proto'
import type { AnyWord } from './word'
import type { Diagnostic } from './diagnostic'

import { LineAnnotationRomanSchema, LineAnnotationSchema, LineAnnotationTranslationSchema, Timing, WordType } from './proto'
import { DiagnosticCode } from './diagnostic'

import { canonicalizeList, childPath, findDuplicates, lowerTag } from '@root/utils'
import { getAnnotationItemText, getWordsLanguages, getWordsText, validateWords } from './word'

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
 * `timing` is the lyric's declared precision, which its words need in order to know whether they own their times.
 * `required` is false where the line's kind is unresolved, so absent content goes unreported while what is present is still checked.
 */
export const validateContent = (
  content: AnyLineContent | undefined,
  time: TimeRange | undefined,
  path = '',
  timing = Timing.UNSPECIFIED,
  required = true,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const contentPath = childPath(path, 'content')
  const hasWords = content !== undefined && content.words.length > 0
  const hasText = content?.text !== undefined
  if (required && !hasWords && !hasText) {
    diagnostics.push({ path, code: DiagnosticCode.LineContentMissing })
  } else if (hasWords && hasText) {
    diagnostics.push({ path: contentPath, code: DiagnosticCode.LineContentAmbiguous })
  }
  diagnostics.push(...validateWords(content?.words ?? [], time, contentPath, timing))
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
export const isWordLevelLine = (line: { content?: AnyLineContent }): boolean => {
  return (line.content?.words.length ?? 0) > 0
}

/**
 * Returns the line's language tags, falling back to those of its words when the line lists none.
 * Both layers carry the same shape, so one helper serves a line and a background line of either.
 */
export const getLineLanguages = (line: { languages: string[]; content?: AnyLineContent }): string[] => {
  return line.languages.length > 0 ? line.languages : getWordsLanguages(line.content?.words ?? [])
}

/**
 * Creates a LineAnnotation, the per-line annotation container.
 */
export const makeLineAnnotation = (init?: MakeInit<typeof LineAnnotationSchema>): LineAnnotation => {
  return create(LineAnnotationSchema, init)
}

/**
 * Validates a LineAnnotation: each of its lists holds one entry per language, so a language may not repeat within one.
 */
export const validateLineAnnotation = (annotation: LineAnnotation, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  /**
   * Reports every entry of one list whose language an earlier entry already took, treating an unset and an empty tag as the same default language.
   */
  const checkLanguages = (items: { language?: string }[], field: string, code: DiagnosticCode): void => {
    findDuplicates(items, (item) => lowerTag(item.language) ?? '').forEach((i) => {
      diagnostics.push({ path: childPath(path, `${field}[${i}]`), code })
    })
  }
  checkLanguages(annotation.romans, 'romans', DiagnosticCode.LineAnnotationRomansLanguageDuplicate)
  checkLanguages(annotation.translations, 'translations', DiagnosticCode.LineAnnotationTranslationsLanguageDuplicate)
  return diagnostics
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
