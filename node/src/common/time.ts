import type { MakeInit } from '@root/utils'
import type { Time } from './proto'

import { TimeSchema } from './proto'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a Time, the half-open range [start, end).
 */
export const makeTime = (init?: MakeInit<typeof TimeSchema>): Time => {
  return create(TimeSchema, init)
}
