import type { MakeInit } from '@root/utils'
import type { LineAnnotation, LineAnnotationRoman, LineAnnotationTranslation } from './proto'

import { LineAnnotationRomanSchema, LineAnnotationSchema, LineAnnotationTranslationSchema } from './proto'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a LineAnnotation, the per-line annotation container.
 */
export const makeLineAnnotation = (init?: MakeInit<typeof LineAnnotationSchema>): LineAnnotation => {
  return create(LineAnnotationSchema, init)
}

/**
 * Creates a LineAnnotationRoman, a romanized transliteration of a whole line.
 */
export const makeLineAnnotationRoman = (init?: MakeInit<typeof LineAnnotationRomanSchema>): LineAnnotationRoman => {
  return create(LineAnnotationRomanSchema, init)
}

/**
 * Creates a LineAnnotationTranslation, a translation of a whole line.
 */
export const makeLineAnnotationTranslation = (init?: MakeInit<typeof LineAnnotationTranslationSchema>): LineAnnotationTranslation => {
  return create(LineAnnotationTranslationSchema, init)
}
