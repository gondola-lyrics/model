import type { MakeInit } from '@root/utils'
import type { UnknownEntry } from '@root/generated/common/index.gen'

import { withInit } from '@root/utils'
import { createCommonUnknownEntry } from '@root/generated/detail.gen'

/**
 * Creates an UnknownEntry, a preserved key-value pair the model has no typed field for.
 */
export const makeUnknownEntry = (init?: MakeInit<UnknownEntry>): UnknownEntry => {
  return withInit(createCommonUnknownEntry(), init)
}

/**
 * Collects the values of every entry carrying the key, in order, since one key may appear more than once.
 * Keys compare exactly, as the source wrote them.
 */
export const getUnknownValues = (unknowns: UnknownEntry[], key: string): string[] => {
  return unknowns.filter((entry) => entry.key === key).map((entry) => entry.value)
}
