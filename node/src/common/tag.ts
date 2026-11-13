import type { MessageFields } from '@root/generated/detail.gen'
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
 * Collects the malformed language tags below a message, reading the tree from its schema: a `languages` list holds tags directly, while a field named `language` holds one tag.
 * Only a malformed tag is reported, since an unset or empty one is what the rule demanding a tag is for.
 * `sealed` names the fields another validator reads, so a tag is never reported twice.
 */
const collectTagDiagnostics = (schema: MessageFields<any>, message: unknown, sealed: readonly string[], path: string): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const entries = message as Record<string, unknown>
  for (const field of schema.fields) {
    const child = path === '' ? field.name : `${path}.${field.name}`
    if (sealed.includes(field.name)) {
      continue
    }
    if (field.shape === 'message') {
      const value = entries[field.name]
      if (value !== undefined) {
        diagnostics.push(...collectTagDiagnostics(field.message, value, sealed, child))
      }
    } else if (field.shape === 'list-message') {
      const values = entries[field.name] as readonly unknown[]
      values.forEach((value, i) => {
        diagnostics.push(...collectTagDiagnostics(field.message, value, sealed, `${child}[${i}]`))
      })
    } else if (field.shape === 'list-scalar' && field.name === 'languages') {
      const values = entries[field.name] as readonly string[]
      values.forEach((value, i) => {
        if (value !== '' && !isLanguageTag(value)) {
          diagnostics.push({ path: `${child}[${i}]`, code: DiagnosticCode.LanguageTagMalformed })
        }
      })
    } else if ((field.shape === 'scalar' || field.shape === 'optional') && field.name === 'language') {
      const value = entries[field.name] as string | undefined
      if (value !== undefined && value !== '' && !isLanguageTag(value)) {
        diagnostics.push({ path: child, code: DiagnosticCode.LanguageTagMalformed })
      }
    }
  }
  return diagnostics
}

/**
 * Collects the malformed language tags of one line: its own list, its words and its annotations.
 * A line is validated on its own as well as under a lyric, so where it sits changes nothing and the path is the line's own.
 */
export const validateLineTags = (schema: MessageFields<any>, line: unknown, path = ''): Diagnostic[] => {
  return collectTagDiagnostics(schema, line, [], path)
}

/**
 * Collects the malformed language tags a lyric carries outside its lines: the language its metadata declares and the tags on every text it holds.
 * The lines are left to `validateLine`, which alone knows which fields a line's kind forbids.
 */
export const validateLyricTags = (schema: MessageFields<any>, lyric: unknown): Diagnostic[] => {
  return collectTagDiagnostics(schema, lyric, ['lines'], '')
}
