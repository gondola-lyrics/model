import type { MakeInit } from '@root/utils'
import type { Word, WordAnnotation, WordAnnotationRoman, WordAnnotationRuby, WordAnnotationToken, WordAnnotationTranslation } from './proto'

import {
  WordAnnotationRomanSchema,
  WordAnnotationRubySchema,
  WordAnnotationSchema,
  WordAnnotationTokenSchema,
  WordAnnotationTranslationSchema,
  WordSchema,
  WordType,
} from './proto'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a normal word, stamping WORD_TYPE_NORMAL so the discriminant can never be set from outside.
 */
export const makeWordNormal = (init: Omit<MakeInit<typeof WordSchema>, 'type'>): Word => {
  return create(WordSchema, { ...init, type: WordType.NORMAL })
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
