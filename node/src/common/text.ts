import type { MakeInit } from '@root/utils'
import type { Text } from './proto'

import { TextSchema } from './proto'

import { lowerTag } from '@root/utils'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a Text, content with an optional BCP 47 language tag, lowercased to canonical form.
 */
export const makeText = (init?: MakeInit<typeof TextSchema>): Text => {
  return create(TextSchema, { ...init, language: init?.language?.toLowerCase() })
}

/**
 * Returns a copy of the Text with its language tag lowercased, treating an empty tag as unset.
 */
export const canonicalizeText = (text: Text): Text => {
  return { ...text, language: lowerTag(text.language) }
}
