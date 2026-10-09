import type { MakeInit } from '@root/utils'
import type { TimeRange, WordAnnotation, WordAnnotationRoman, WordAnnotationRuby, WordAnnotationToken, WordAnnotationTranslation } from './proto'
import type { Diagnostic } from './diagnostic'

import {
  Timing,
  WordAnnotationRomanSchema,
  WordAnnotationRubySchema,
  WordAnnotationSchema,
  WordAnnotationTokenSchema,
  WordAnnotationTranslationSchema,
  WordType,
  WordTypeSchema,
} from './proto'
import { DiagnosticCode } from './diagnostic'

import {
  canonicalizeField,
  canonicalizeList,
  childPath,
  findDuplicates,
  getTimeRangeEnd,
  isTimeRangeOrdered,
  isUnresolved,
  lowerTag,
} from '@root/utils'
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
 * A separator between two words, which the schema defines as the Unicode White_Space property.
 * The property is named rather than listed, so every language reads the same set from its own standard library; what each language calls whitespace does not agree.
 * `U+200B` is a format character rather than a space, so it stays part of a sung word.
 */
const ANY_SEPARATOR = /\p{White_Space}/u
const ONLY_SEPARATORS = /^\p{White_Space}+$/u

/**
 * Creates a WordAnnotationToken, one timed piece of a ruby or roman annotation.
 */
export const makeWordAnnotationToken = (init?: MakeInit<typeof WordAnnotationTokenSchema>): WordAnnotationToken => {
  return create(WordAnnotationTokenSchema, init)
}

/**
 * Creates a WordAnnotationRoman, a romanized transliteration of a single word.
 */
export const makeWordAnnotationRoman = (init?: MakeInit<typeof WordAnnotationRomanSchema>): WordAnnotationRoman => {
  return create(WordAnnotationRomanSchema, init)
}

/**
 * Creates a WordAnnotationTranslation, a translation of a single word.
 */
export const makeWordAnnotationTranslation = (init?: MakeInit<typeof WordAnnotationTranslationSchema>): WordAnnotationTranslation => {
  return create(WordAnnotationTranslationSchema, init)
}

/**
 * Creates a WordAnnotationRuby, a ruby annotation of a single word such as furigana.
 */
export const makeWordAnnotationRuby = (init?: MakeInit<typeof WordAnnotationRubySchema>): WordAnnotationRuby => {
  return create(WordAnnotationRubySchema, init)
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
 * Validates a Word: its kind must be resolved, a NORMAL word must carry non-empty text holding no separator, a SPACE word must carry a separator and nothing else, and any time and annotation it does carry must be valid.
 */
export const validateWord = (word: AnyWord, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  // A kind outside the enum reads as unresolved too, since a value this schema does not know cannot be held to any of its kind's rules.
  if (isUnresolved(WordTypeSchema, word.type)) {
    diagnostics.push({ path, code: DiagnosticCode.WordTypeUnspecified })
  }
  if (word.type === WordType.NORMAL && word.text === '') {
    diagnostics.push({ path, code: DiagnosticCode.WordTextEmpty })
  } else if (word.type === WordType.NORMAL && ANY_SEPARATOR.test(word.text)) {
    // The separators around a word belong to the SPACE words beside it, so a sung word holding one has swallowed a boundary that words are split on.
    diagnostics.push({ path: childPath(path, 'text'), code: DiagnosticCode.WordTextSeparator })
  }
  if (word.type === WordType.SPACE) {
    // A SPACE word is the separator, so its text is what the rule is about; an empty one separates nothing and is reported the same way.
    if (!ONLY_SEPARATORS.test(word.text)) {
      diagnostics.push({ path: childPath(path, 'text'), code: DiagnosticCode.WordTextNotSeparator })
    }
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
 * Validates the words of a line or background line: each word must be valid, each sung word must carry a time, and each timed word must fall within `time` when it is set.
 * Those two time rules hold only where `timing` puts timing on the words; under NONE and LINE the lyric reports the words themselves instead.
 */
export const validateWords = (words: AnyWord[], time: TimeRange | undefined, path = '', timing = Timing.UNSPECIFIED): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const ownTimes = timing !== Timing.NONE && timing !== Timing.LINE
  words.forEach((word, i) => {
    const wordPath = childPath(path, `words[${i}]`)
    diagnostics.push(...validateWord(word, wordPath))
    if (ownTimes && word.type === WordType.NORMAL && word.time === undefined) {
      diagnostics.push({ path: wordPath, code: DiagnosticCode.LineWordTimeMissing })
    }
    // A range reported for its own numbers or order never joins this comparison, on either side, and an absent one has nothing to compare.
    // A SPACE word was already told to carry no time at all, so its range stays out of it too.
    if (
      ownTimes &&
      word.type !== WordType.SPACE &&
      isTimeRangeOrdered(time) &&
      isTimeRangeOrdered(word.time) &&
      (word.time.start < time.start || getTimeRangeEnd(word.time) > getTimeRangeEnd(time))
    ) {
      diagnostics.push({ path: childPath(wordPath, 'time'), code: DiagnosticCode.LineWordTimeUncovered })
    }
  })
  return diagnostics
}

/**
 * Returns a copy of the annotation token, which holds only a time and its text and so has nothing to normalize.
 */
export const canonicalizeWordAnnotationToken = (token: WordAnnotationToken): WordAnnotationToken => {
  return { ...token }
}

/**
 * Returns a copy of the roman annotation with its language lowercased and its tokens canonicalized.
 */
export const canonicalizeWordAnnotationRoman = (roman: WordAnnotationRoman): WordAnnotationRoman => {
  return {
    ...roman,
    language: lowerTag(roman.language),
    tokens: canonicalizeList(WordAnnotationTokenSchema, roman.tokens, canonicalizeWordAnnotationToken),
  }
}

/**
 * Returns a copy of the ruby annotation with its language lowercased and its tokens canonicalized.
 */
export const canonicalizeWordAnnotationRuby = (ruby: WordAnnotationRuby): WordAnnotationRuby => {
  return {
    ...ruby,
    language: lowerTag(ruby.language),
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
 * Returns a copy of the word with the fields every layer shares canonicalized: its language lowercased, and its annotation canonicalized then dropped when empty.
 * Each layer's `canonicalizeWord` builds on this to handle its own fields.
 */
export const canonicalizeWordShared = <T extends AnyWord>(word: T): T => {
  return {
    ...word,
    language: lowerTag(word.language),
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
