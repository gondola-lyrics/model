import type { MakeInit } from '@root/utils'
import type { Word, WordEmphasis } from './proto'

import { WordType } from '@root/common/proto'
import { WordEmphasisSchema, WordSchema } from './proto'

import { dropDefault } from '@root/utils'
import { canonicalizeWordShared } from '@root/common'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a normal word, stamping WORD_TYPE_NORMAL so the discriminant can never be set from outside.
 */
export const makeWordNormal = (init: Omit<MakeInit<typeof WordSchema>, 'type'>): Word => {
  return create(WordSchema, {
    type: WordType.NORMAL,
    time: init.time,
    text: init.text,
    language: init.language,
    annotation: init.annotation,
    emphasis: init.emphasis,
  })
}

/**
 * Creates a whitespace word carrying the separator as its text, stamping WORD_TYPE_SPACE.
 */
export const makeWordSpace = (init: Pick<MakeInit<typeof WordSchema>, 'text'>): Word => {
  return create(WordSchema, { text: init.text, type: WordType.SPACE })
}

/**
 * Creates a WordEmphasis, whether a word is emphasized and whether that was derived rather than stated.
 */
export const makeWordEmphasis = (init?: MakeInit<typeof WordEmphasisSchema>): WordEmphasis => {
  return create(WordEmphasisSchema, init)
}

/**
 * Returns a copy of the word canonicalized, with its emphasis dropped when all-default.
 */
export const canonicalizeWord = (word: Word): Word => {
  return { ...canonicalizeWordShared(word), emphasis: dropDefault(WordEmphasisSchema, word.emphasis) }
}
