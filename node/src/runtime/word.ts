import type { MakeInit } from '@root/utils'
import type { Word, WordEmphasis } from '@root/generated/runtime/index.gen'

import { WordType } from '@root/generated/common/index.gen'

import { copyMessage, dropDefault, withInit } from '@root/utils'
import { createRuntimeWord, createRuntimeWordEmphasis, fieldsRuntimeWordEmphasis } from '@root/generated/detail.gen'
import { canonicalizeWordShared } from '@root/common'

/**
 * Creates a normal word, stamping WORD_TYPE_NORMAL so the discriminant can never be set from outside.
 */
export const makeWordNormal = (init?: Omit<MakeInit<Word>, 'type'>): Word => {
  return withInit(createRuntimeWord(), {
    type: WordType.NORMAL,
    time: init?.time,
    text: init?.text,
    language: init?.language,
    annotation: init?.annotation,
    emphasis: init?.emphasis,
  })
}

/**
 * Creates a whitespace word carrying the separator as its text, stamping WORD_TYPE_SPACE.
 */
export const makeWordSpace = (init?: Pick<MakeInit<Word>, 'text'>): Word => {
  return withInit(createRuntimeWord(), { text: init?.text, type: WordType.SPACE })
}

/**
 * Creates an emphasis decision without defaulting its value or origin; explicit false values are preserved.
 */
export const makeWordEmphasis = (init?: MakeInit<WordEmphasis>): WordEmphasis => {
  return withInit(createRuntimeWordEmphasis(), init)
}

/**
 * Returns a copy of the word canonicalized, dropping empty emphasis while preserving explicit false values.
 */
export const canonicalizeWord = (word: Word): Word => {
  return { ...canonicalizeWordShared(word), emphasis: dropDefault(fieldsRuntimeWordEmphasis, copyMessage(word.emphasis)) }
}
