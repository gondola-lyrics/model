import type { MakeInit } from '@root/utils'
import type { TimeRange, WordAnnotation, WordAnnotationRoman, WordAnnotationRuby, WordAnnotationToken, WordAnnotationTranslation } from './proto'
import type { Diagnostic } from './diagnostic'

import {
  WordAnnotationRomanSchema,
  WordAnnotationRubySchema,
  WordAnnotationSchema,
  WordAnnotationTokenSchema,
  WordAnnotationTranslationSchema,
  WordType,
} from './proto'
import { TimeRangeSchema } from './proto'
import { DiagnosticCode } from './diagnostic'

import { canonicalizeField, canonicalizeList, childPath, dropDefault, findDuplicates, isTimeRangeInDomain, lowerTag } from '@root/utils'
import { validateTimeRange } from './time'

import { create } from '@bufbuild/protobuf'

/**
 * The fields every layer's word shares, so helpers that only read them work on either layer.
 */
export type AnyWord = {
  type: WordType
  time?: TimeRange
  text: string
  language?: string
  annotation?: WordAnnotation
}

/**
 * Creates a WordAnnotationToken, one timed piece of a ruby or roman annotation.
 */
export const makeWordAnnotationToken = (init?: MakeInit<typeof WordAnnotationTokenSchema>): WordAnnotationToken => {
  return create(WordAnnotationTokenSchema, init)
}

/**
 * Creates a WordAnnotationRoman, a romanized transliteration of a single word; its language tag is lowercased.
 */
export const makeWordAnnotationRoman = (init?: MakeInit<typeof WordAnnotationRomanSchema>): WordAnnotationRoman => {
  return create(WordAnnotationRomanSchema, { ...init, language: init?.language?.toLowerCase() })
}

/**
 * Creates a WordAnnotationTranslation, a translation of a single word; its language tag is lowercased.
 */
export const makeWordAnnotationTranslation = (init?: MakeInit<typeof WordAnnotationTranslationSchema>): WordAnnotationTranslation => {
  return create(WordAnnotationTranslationSchema, { ...init, language: init?.language?.toLowerCase() })
}

/**
 * Creates a WordAnnotationRuby, a ruby annotation of a single word such as furigana; its language tag is lowercased.
 */
export const makeWordAnnotationRuby = (init?: MakeInit<typeof WordAnnotationRubySchema>): WordAnnotationRuby => {
  return create(WordAnnotationRubySchema, { ...init, language: init?.language?.toLowerCase() })
}

/**
 * Creates a WordAnnotation, the per-word annotation container.
 */
export const makeWordAnnotation = (init?: MakeInit<typeof WordAnnotationSchema>): WordAnnotation => {
  return create(WordAnnotationSchema, init)
}

/**
 * Validates a WordAnnotation: each of its lists holds one entry per language, and every ruby and roman item, and every token within them, must carry a valid time when it carries one at all.
 * An item or token without a time inherits one, so its absence is never a problem here.
 */
export const validateWordAnnotation = (annotation: WordAnnotation, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  /**
   * Reports every entry of one list whose language an earlier entry already took, treating an unset and an empty tag as the same default language.
   */
  const checkLanguages = (items: { language?: string }[], field: string, code: DiagnosticCode): void => {
    findDuplicates(items, (item) => lowerTag(item.language) ?? '').forEach((i) => {
      diagnostics.push({ path: childPath(path, `${field}[${i}]`), code })
    })
  }
  /**
   * Validates the time of every item in one timed annotation list, and of every token those items hold.
   */
  const validateItems = (items: (WordAnnotationRuby | WordAnnotationRoman)[], field: string): void => {
    items.forEach((item, i) => {
      const itemPath = childPath(path, `${field}[${i}]`)
      if (item.time) {
        diagnostics.push(...validateTimeRange(item.time, childPath(itemPath, 'time')))
      }
      item.tokens.forEach((token, j) => {
        if (token.time) {
          diagnostics.push(...validateTimeRange(token.time, childPath(itemPath, `tokens[${j}].time`)))
        }
      })
    })
  }
  checkLanguages(annotation.rubies, 'rubies', DiagnosticCode.LineWordAnnotationRubiesLanguageDuplicate)
  checkLanguages(annotation.romans, 'romans', DiagnosticCode.LineWordAnnotationRomansLanguageDuplicate)
  checkLanguages(annotation.translations, 'translations', DiagnosticCode.LineWordAnnotationTranslationsLanguageDuplicate)
  validateItems(annotation.rubies, 'rubies')
  validateItems(annotation.romans, 'romans')
  return diagnostics
}

/**
 * Validates a Word: its kind must be resolved, a NORMAL word must carry non-empty text, a SPACE word must carry nothing but its text, and any time and annotation it does carry must be valid.
 */
export const validateWord = (word: AnyWord, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (word.type === WordType.UNSPECIFIED) {
    diagnostics.push({ path, code: DiagnosticCode.WordTypeUnspecified })
  }
  if (word.type === WordType.NORMAL && word.text === '') {
    diagnostics.push({ path, code: DiagnosticCode.WordTextEmpty })
  }
  if (word.type === WordType.SPACE) {
    // A SPACE word carries the separator and nothing else; a field holding an all-default value still counts as carried, and a forbidden one is never descended into.
    if (word.time !== undefined) {
      diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LineWordTimeUnexpected })
    }
    if (word.language !== undefined) {
      diagnostics.push({ path: childPath(path, 'language'), code: DiagnosticCode.LineWordLanguageUnexpected })
    }
    if (word.annotation !== undefined) {
      diagnostics.push({ path: childPath(path, 'annotation'), code: DiagnosticCode.LineWordAnnotationUnexpected })
    }
    // Each layer shapes emphasis differently, so it is read through presence alone rather than through either layer's schema.
    if ('emphasis' in word && word.emphasis !== undefined) {
      diagnostics.push({ path: childPath(path, 'emphasis'), code: DiagnosticCode.LineWordEmphasisUnexpected })
    }
    return diagnostics
  }
  if (word.time) {
    diagnostics.push(...validateTimeRange(word.time, childPath(path, 'time')))
  }
  if (word.annotation) {
    diagnostics.push(...validateWordAnnotation(word.annotation, childPath(path, 'annotation')))
  }
  return diagnostics
}

/**
 * Validates the words of a line or background line: each word must be valid, each sung word must carry a usable time, and each timed word must fall within `time` when it is set.
 */
export const validateWords = (words: AnyWord[], time: TimeRange | undefined, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  words.forEach((word, i) => {
    const wordPath = childPath(path, `words[${i}]`)
    diagnostics.push(...validateWord(word, wordPath))
    // An all-default range is omitted by the schema and reads as no timing at all, so a sung word carrying one has no time either.
    const missing = word.type === WordType.NORMAL && (word.time === undefined || (word.time.start === 0 && word.time.end === 0))
    if (missing) {
      diagnostics.push({ path: wordPath, code: DiagnosticCode.LineWordTimeMissing })
    }
    // A word already reported for its own time, whether it is missing or not allowed at all, is not compared against the line on top of that.
    const comparable = !missing && word.type !== WordType.SPACE
    if (comparable && isTimeRangeInDomain(time) && isTimeRangeInDomain(word.time) && (word.time.start < time.start || word.time.end > time.end)) {
      diagnostics.push({ path: childPath(wordPath, 'time'), code: DiagnosticCode.LineWordTimeUncovered })
    }
  })
  return diagnostics
}

/**
 * Returns a copy of the annotation token with its time dropped when all-default.
 */
export const canonicalizeWordAnnotationToken = (token: WordAnnotationToken): WordAnnotationToken => {
  return { ...token, time: dropDefault(TimeRangeSchema, token.time) }
}

/**
 * Returns a copy of the roman annotation with its language lowercased, time dropped when all-default, and tokens canonicalized.
 */
export const canonicalizeWordAnnotationRoman = (roman: WordAnnotationRoman): WordAnnotationRoman => {
  return {
    ...roman,
    language: lowerTag(roman.language),
    time: dropDefault(TimeRangeSchema, roman.time),
    tokens: canonicalizeList(WordAnnotationTokenSchema, roman.tokens, canonicalizeWordAnnotationToken),
  }
}

/**
 * Returns a copy of the ruby annotation with its language lowercased, time dropped when all-default, and tokens canonicalized.
 */
export const canonicalizeWordAnnotationRuby = (ruby: WordAnnotationRuby): WordAnnotationRuby => {
  return {
    ...ruby,
    language: lowerTag(ruby.language),
    time: dropDefault(TimeRangeSchema, ruby.time),
    tokens: canonicalizeList(WordAnnotationTokenSchema, ruby.tokens, canonicalizeWordAnnotationToken),
  }
}

/**
 * Returns a copy of the translation annotation with its language lowercased.
 */
export const canonicalizeWordAnnotationTranslation = (translation: WordAnnotationTranslation): WordAnnotationTranslation => {
  return { ...translation, language: lowerTag(translation.language) }
}

/**
 * Returns a copy of the annotation with each of its lists canonicalized and all-default entries dropped.
 */
export const canonicalizeWordAnnotation = (annotation: WordAnnotation): WordAnnotation => {
  return {
    ...annotation,
    rubies: canonicalizeList(WordAnnotationRubySchema, annotation.rubies, canonicalizeWordAnnotationRuby),
    romans: canonicalizeList(WordAnnotationRomanSchema, annotation.romans, canonicalizeWordAnnotationRoman),
    translations: canonicalizeList(WordAnnotationTranslationSchema, annotation.translations, canonicalizeWordAnnotationTranslation),
  }
}

/**
 * Returns a copy of the word with the fields every layer shares canonicalized: its language lowercased, its time dropped when all-default, and its annotation canonicalized then dropped when empty.
 * Each layer's `canonicalizeWord` builds on this to handle its own fields.
 */
export const canonicalizeWordShared = <T extends AnyWord>(word: T): T => {
  return {
    ...word,
    language: lowerTag(word.language),
    time: dropDefault(TimeRangeSchema, word.time),
    annotation: canonicalizeField(WordAnnotationSchema, word.annotation, canonicalizeWordAnnotation),
  }
}

/**
 * Resolves an annotation item's effective time, following the inheritance chain: its own time, else the annotated word's.
 */
export const resolveAnnotationItemTime = (item: WordAnnotationRoman | WordAnnotationRuby, word: AnyWord): TimeRange | undefined => {
  return item.time ?? word.time
}

/**
 * Resolves an annotation token's effective time, following the inheritance chain: its own time, else its item's, else the annotated word's.
 */
export const resolveAnnotationTokenTime = (
  token: WordAnnotationToken,
  item: WordAnnotationRoman | WordAnnotationRuby,
  word: AnyWord,
): TimeRange | undefined => {
  return token.time ?? resolveAnnotationItemTime(item, word)
}

/**
 * Joins the text of words in order, which restores the source text since separators are words of their own.
 */
export const getWordsText = (words: AnyWord[]): string => {
  return words.map((word) => word.text).join('')
}

/**
 * Collects the distinct lowercased language tags of normal words, in order of first appearance.
 */
export const getWordsLanguages = (words: AnyWord[]): string[] => {
  const normal = words.filter((word) => word.type === WordType.NORMAL)
  return [...new Set(normal.map((word) => lowerTag(word.language)).filter((tag) => tag !== undefined))]
}

/**
 * Joins the text of an annotation item's tokens with nothing in between, as they compose the item in order.
 */
export const getAnnotationItemText = (item: WordAnnotationRoman | WordAnnotationRuby): string => {
  return item.tokens.map((token) => token.text).join('')
}
