import type { MakeInit } from '@root/utils'
import type { Text } from './proto'
import type { Diagnostic } from './diagnostic'

import { TextSchema } from './proto'
import { DiagnosticCode } from './diagnostic'

import { lowerTag } from '@root/utils'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a Text, text with an optional BCP 47 language tag, lowercased to canonical form.
 */
export const makeText = (init?: MakeInit<typeof TextSchema>): Text => {
  return create(TextSchema, { ...init, language: init?.language?.toLowerCase() })
}

/**
 * Validates a Text: its text must be non-empty, since a Text names something and an empty one names nothing.
 * A list holding one entry per language still holds a language with it, so the empty entry is reported here rather than dropped.
 */
export const validateText = (text: Text, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (text.text === '') {
    diagnostics.push({ path, code: DiagnosticCode.TextTextEmpty })
  }
  return diagnostics
}

/**
 * Returns a copy of the Text with its language tag lowercased, treating an empty tag as unset.
 */
export const canonicalizeText = (text: Text): Text => {
  return { ...text, language: lowerTag(text.language) }
}
