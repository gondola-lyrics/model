import type { MakeInit } from '@root/utils'
import type { LineAnnotation, LineAnnotationRoman, LineAnnotationTranslation } from './proto'

import { LineAnnotationRomanSchema, LineAnnotationSchema, LineAnnotationTranslationSchema } from './proto'

import { canonicalizeList, lowerTag } from '@root/utils'

import { create } from '@bufbuild/protobuf'

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
