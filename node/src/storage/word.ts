import type { MakeInit } from '@root/utils'
import type { Word } from './proto'

import { WordType } from '@root/common/proto'
import { WordSchema } from './proto'

import { canonicalizeWordShared } from '@root/common'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a normal word, stamping WORD_TYPE_NORMAL so the discriminant can never be set from outside; its language tag is lowercased.
 */
export const makeWordNormal = (init: Omit<MakeInit<typeof WordSchema>, 'type'>): Word => {
  return create(WordSchema, { ...init, type: WordType.NORMAL, language: init.language?.toLowerCase() })
}

/**
 * Creates a whitespace word carrying the separator as its text, stamping WORD_TYPE_SPACE.
 */
export const makeWordSpace = (init: Pick<MakeInit<typeof WordSchema>, 'text'>): Word => {
  return create(WordSchema, { ...init, type: WordType.SPACE })
}

/**
 * Returns a copy of the word canonicalized; it carries no fields beyond the shared ones.
 */
export const canonicalizeWord = (word: Word): Word => {
  return canonicalizeWordShared(word)
}
