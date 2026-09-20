import type { MakeInit } from '@root/utils'
import type { Word, WordAnnotation, WordAnnotationRoman, WordAnnotationRuby, WordAnnotationToken, WordAnnotationTranslation } from './proto'
import type { Diagnostic } from './diagnostic'

import {
  WordAnnotationRomanSchema,
  WordAnnotationRubySchema,
  WordAnnotationSchema,
  WordAnnotationTokenSchema,
  WordAnnotationTranslationSchema,
  WordSchema,
  WordType,
} from './proto'
import { TimeSchema } from './proto'
import { DiagnosticCode } from './diagnostic'

import { canonicalizeField, canonicalizeList, childPath, dropDefault, lowerTag } from '@root/utils'
import { validateTime } from './time'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a normal word, stamping WORD_TYPE_NORMAL so the discriminant can never be set from outside; its language tag is lowercased.
 */
export const makeWordNormal = (init: Omit<MakeInit<typeof WordSchema>, 'type'>): Word => {
  return create(WordSchema, { ...init, type: WordType.NORMAL, language: init.language?.toLowerCase() })
}

/**
 * Creates a whitespace word carrying the separator as its content, stamping WORD_TYPE_SPACE.
 */
export const makeWordSpace = (init: Pick<MakeInit<typeof WordSchema>, 'content'>): Word => {
  return create(WordSchema, { ...init, type: WordType.SPACE })
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
 * Validates a Word: a NORMAL word must carry non-empty content, and its Time, when set, must be valid.
 */
export const validateWord = (word: Word, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (word.type === WordType.NORMAL && word.content === '') {
    diagnostics.push({ path, code: DiagnosticCode.WordContentEmpty })
  }
  if (word.time) {
    diagnostics.push(...validateTime(word.time, childPath(path, 'time')))
  }
  return diagnostics
}

/**
 * Returns a copy of the annotation token with its time dropped when all-default.
 */
export const canonicalizeWordAnnotationToken = (token: WordAnnotationToken): WordAnnotationToken => {
  return { ...token, time: dropDefault(TimeSchema, token.time) }
}

/**
 * Returns a copy of the roman annotation with its language lowercased, time dropped when all-default, and tokens canonicalized.
 */
export const canonicalizeWordAnnotationRoman = (roman: WordAnnotationRoman): WordAnnotationRoman => {
  return {
    ...roman,
    language: lowerTag(roman.language),
    time: dropDefault(TimeSchema, roman.time),
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
    time: dropDefault(TimeSchema, ruby.time),
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
 * Returns a copy of the word with its language lowercased, time dropped when all-default, and annotation canonicalized then dropped when empty.
 */
export const canonicalizeWord = (word: Word): Word => {
  return {
    ...word,
    language: lowerTag(word.language),
    time: dropDefault(TimeSchema, word.time),
    annotation: canonicalizeField(WordAnnotationSchema, word.annotation, canonicalizeWordAnnotation),
  }
}
