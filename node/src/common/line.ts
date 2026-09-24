import type { MakeInit } from '@root/utils'
import type { LineAnnotation, LineAnnotationRoman, LineAnnotationTranslation, Word } from './proto'

import { LineAnnotationRomanSchema, LineAnnotationSchema, LineAnnotationTranslationSchema, WordType } from './proto'

import { canonicalizeList, lowerTag } from '@root/utils'
import { getAnnotationItemText } from './word'

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

/**
 * Derives line-level romans from the words' own, one per language in order of first appearance; the result is for display and must never be stored on the line.
 * Words lacking a roman in that language are skipped, and any spaces between two romanized words collapse to a single U+0020.
 */
export const deriveLineRomans = (words: Word[]): LineAnnotationRoman[] => {
  const languages = new Set(words.flatMap((word) => word.annotation?.romans.map((roman) => lowerTag(roman.language)) ?? []))
  const romans: LineAnnotationRoman[] = []
  for (const language of languages) {
    let content = ''
    let spaced = false
    for (const word of words) {
      if (word.type === WordType.SPACE) {
        spaced = true
        continue
      }
      const roman = word.annotation?.romans.find((item) => lowerTag(item.language) === language)
      const text = roman ? getAnnotationItemText(roman) : ''
      if (text !== '') {
        content += content !== '' && spaced ? ` ${text}` : text
        spaced = false
      }
    }
    if (content !== '') {
      romans.push(makeLineAnnotationRoman({ language, content }))
    }
  }
  return romans
}
