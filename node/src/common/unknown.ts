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
