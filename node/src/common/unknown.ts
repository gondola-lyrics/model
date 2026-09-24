import type { MakeInit } from '@root/utils'
import type { Unknown } from './proto'

import { UnknownSchema } from './proto'

import { create } from '@bufbuild/protobuf'

/**
 * Creates an Unknown, a preserved key-value pair the model has no typed field for.
 */
export const makeUnknown = (init?: MakeInit<typeof UnknownSchema>): Unknown => {
  return create(UnknownSchema, init)
}

/**
 * Collects the values of every unknown carrying the key, in order, since one key may appear more than once.
 * Keys compare exactly, as the source wrote them.
 */
export const getUnknownValues = (unknowns: Unknown[], key: string): string[] => {
  return unknowns.filter((unknown) => unknown.key === key).map((unknown) => unknown.value)
}
