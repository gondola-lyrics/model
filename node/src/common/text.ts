import type { MakeInit } from '@root/utils'
import type { Text, TextToken } from '@root/generated/common/index.gen'
import type { Diagnostic } from './diagnostic'

import { createCommonText, createCommonTextToken } from '@root/generated/detail.gen'
import { childPath, copyMessage, lowerTag, withInit } from '@root/utils'

import { DiagnosticCode } from './diagnostic'
import { validateLanguageTag } from './tag'
import { validateTimeRange } from './time'

/**
 * Creates a Text, text with an optional BCP 47 language tag.
 * The tag is kept as given, since canonical form is `canonicalizeText`'s to produce and a constructor that quietly rewrote one would make two spellings of the same field.
 */
export const makeText = (init?: MakeInit<Text>): Text => {
  return withInit(createCommonText(), init)
}

/**
 * Checks non-empty text and the optional language tag.
 *
 * Paths are relative to this text unless its location is supplied.
 */
export const validateText = (text: Text, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (text.text === '') {
    diagnostics.push({ path, code: DiagnosticCode.TextTextEmpty })
  }
  diagnostics.push(...validateLanguageTag(text.language, childPath(path, 'language')))
  return diagnostics
}

/**
 * Returns a copy of the Text with its language tag lowercased, treating an empty tag as unset.
 */
export const canonicalizeText = (text: Text): Text => {
  return { ...text, language: lowerTag(text.language) }
}

/**
 * Creates a source fragment without normalizing its text or extension attributes.
 */
export const makeTextToken = (init?: MakeInit<TextToken>): TextToken => {
  return withInit(createCommonTextToken(), init)
}

/**
 * Checks explicit timing and extension keys; text constraints belong to the containing annotation.
 */
export const validateTextToken = (token: TextToken, path = ''): Diagnostic[] => {
  const diagnostics = token.time === undefined ? [] : validateTimeRange(token.time, childPath(path, 'time'))
  if (Object.hasOwn(token.extra, '')) {
    diagnostics.push({ path: childPath(path, 'extra'), code: DiagnosticCode.TextTokenExtraKeyEmpty })
  }
  return diagnostics
}

/**
 * Copies timing and extensions without changing text, keys, or values.
 */
export const canonicalizeTextToken = (token: TextToken): TextToken => {
  return { ...token, time: copyMessage(token.time), extra: { ...token.extra } }
}
