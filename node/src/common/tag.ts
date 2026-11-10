import type { MessageFields } from '@root/generated/internal.gen'
import type { Diagnostic } from './diagnostic'

import { DiagnosticCode } from './diagnostic'

/**
 * A tag is written as subtags of letters and digits, one to eight each, the first naming the language and so letters alone.
 * A private-use tag may be one subtag, so the bound is on the parts rather than their count.
 */
const SUBTAG_PATTERN = /^[a-z0-9]{1,8}$/
const LANGUAGE_PATTERN = /^[a-z]{2,8}$/

/**
 * The longest tag in the registry is 35 characters, so anything past that is not one.
 */
const MAX_TAG_LENGTH = 35

/**
 * The fields holding a transliteration scheme rather than a tag, which no tag is written like; `romaji` and `Hepburn` name how a text is romanized.
 */
const TRANSLITERATION_FIELDS: readonly string[] = ['annotation.romans.language']

/**
 * Reports whether a tag is a well-formed BCP 47 language tag.
 * Only the shape is read, so `qqq` passes: whether a subtag is registered belongs to the registry rather than to this schema.
 * Tags are compared case-insensitively by the schema, and stored in lower case by its own rule, so a tag is read in lower case here.
 */
export const isLanguageTag = (tag: string): boolean => {
  const lower = tag.toLowerCase()
  if (lower.length > MAX_TAG_LENGTH) {
    return false
  }
  const subtags = lower.split('-')
  return LANGUAGE_PATTERN.test(subtags[0]!) && subtags.every((subtag) => SUBTAG_PATTERN.test(subtag))
}

/**
 * Collects the malformed language tags below a message, reading the tree from its schema: a `languages` list holds tags directly, while a field named `language` holds one tag.
 * Only a malformed tag is reported, since an unset or empty one is what the rule demanding a tag is for.
 * `exempt` names the fields that may hold a scheme instead, and `sealed` the fields another validator reads, so a tag is never reported twice.
 */
const collectTagDiagnostics = (
  schema: MessageFields<any>,
  message: unknown,
  exempt: readonly string[],
  sealed: readonly string[],
  path: string,
): Diagnostic[] => {
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
        diagnostics.push(...collectTagDiagnostics(field.message, value, exempt, sealed, child))
      }
    } else if (field.shape === 'list-message') {
      const values = entries[field.name] as readonly unknown[]
      values.forEach((value, i) => {
        diagnostics.push(...collectTagDiagnostics(field.message, value, exempt, sealed, `${child}[${i}]`))
      })
    } else if (field.shape === 'list-scalar' && field.name === 'languages') {
      const values = entries[field.name] as readonly string[]
      values.forEach((value, i) => {
        if (value !== '' && !isLanguageTag(value)) {
          diagnostics.push({ path: `${child}[${i}]`, code: DiagnosticCode.LanguageTagMalformed })
        }
      })
    } else if (
      (field.shape === 'scalar' || field.shape === 'optional') &&
      field.name === 'language' &&
      !exempt.some((name) => child.endsWith(name))
    ) {
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
  return collectTagDiagnostics(schema, line, TRANSLITERATION_FIELDS, [], path)
}

/**
 * Collects the malformed language tags a lyric carries outside its lines: the language its metadata declares and the tags on every text it holds.
 * The lines are left to `validateLine`, which alone knows which fields a line's kind forbids.
 */
export const validateLyricTags = (schema: MessageFields<any>, lyric: unknown): Diagnostic[] => {
  return collectTagDiagnostics(schema, lyric, [], ['lines'], '')
}
