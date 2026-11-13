import type { Diagnostic } from './diagnostic'

import { DiagnosticCode } from './diagnostic'

const INVALID_TAG_CHARACTER = /[^A-Za-z0-9-]/
const LANGUAGE_PATTERN = /^[a-z]{2,8}$/
const EXTLANG_PATTERN = /^[a-z]{3}$/
const SCRIPT_PATTERN = /^[a-z]{4}$/
const REGION_PATTERN = /^(?:[a-z]{2}|[0-9]{3})$/
const VARIANT_PATTERN = /^(?:[a-z0-9]{5,8}|[0-9][a-z0-9]{3})$/

/**
 * RFC 5646 fixes this list; several entries cannot be parsed as ordinary tags.
 */
const GRANDFATHERED_TAGS = new Set([
  'en-gb-oed',
  'i-ami',
  'i-bnn',
  'i-default',
  'i-enochian',
  'i-hak',
  'i-klingon',
  'i-lux',
  'i-mingo',
  'i-navajo',
  'i-pwn',
  'i-tao',
  'i-tay',
  'i-tsu',
  'sgn-be-fr',
  'sgn-be-nl',
  'sgn-ch-de',
  'art-lojban',
  'cel-gaulish',
  'no-bok',
  'no-nyn',
  'zh-guoyu',
  'zh-hakka',
  'zh-min',
  'zh-min-nan',
  'zh-xiang',
])

/**
 * Checks BCP 47 syntax as defined by RFC 5646, including private use and grandfathered tags.
 *
 * Registry validity, uniqueness of variants and extension singletons, and extension semantics are not checked.
 */
export const isLanguageTag = (tag: string): boolean => {
  // Check before case conversion, which can map non-ASCII characters into ASCII.
  if (tag === '' || INVALID_TAG_CHARACTER.test(tag)) {
    return false
  }
  const lower = tag.toLowerCase()
  if (GRANDFATHERED_TAGS.has(lower)) {
    return true
  }
  const subtags = lower.split('-')
  if (subtags.some((subtag) => subtag.length === 0 || subtag.length > 8)) {
    return false
  }
  const language = subtags[0]!
  if (language === 'x') {
    return subtags.length > 1
  }
  if (!LANGUAGE_PATTERN.test(language)) {
    return false
  }

  let index = 1
  if (language.length <= 3) {
    let extlangs = 0
    while (extlangs < 3 && EXTLANG_PATTERN.test(subtags[index] ?? '')) {
      index++
      extlangs++
    }
  }
  if (SCRIPT_PATTERN.test(subtags[index] ?? '')) {
    index++
  }
  if (REGION_PATTERN.test(subtags[index] ?? '')) {
    index++
  }
  while (VARIANT_PATTERN.test(subtags[index] ?? '')) {
    index++
  }
  while (subtags[index]?.length === 1 && subtags[index] !== 'x') {
    index++
    const contentStart = index
    while (index < subtags.length && subtags[index]!.length >= 2) {
      index++
    }
    if (index === contentStart) {
      return false
    }
  }
  if (subtags[index] === 'x') {
    return index + 1 < subtags.length
  }
  return index === subtags.length
}

/**
 * Checks a non-empty tag after its owner has established that the field is allowed.
 */
export const validateLanguageTag = (tag: string | undefined, path = ''): Diagnostic[] => {
  if (tag !== undefined && tag !== '' && !isLanguageTag(tag)) {
    return [{ path, code: DiagnosticCode.LanguageTagMalformed }]
  }
  return []
}

/**
 * Checks a permitted tag list, where empty entries cannot name a language.
 */
export const validateLanguageTags = (tags: string[], path = ''): Diagnostic[] => {
  return tags.flatMap((tag, i) => {
    const tagPath = `${path}[${i}]`
    return tag === '' ? [{ path: tagPath, code: DiagnosticCode.LyricListEntryEmpty }] : validateLanguageTag(tag, tagPath)
  })
}
