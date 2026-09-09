import type { MakeInit } from '@root/utils'
import type { Part } from './proto'

import { PartSchema } from './proto'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a Part, the structural section a line belongs to.
 */
export const makePart = (init?: MakeInit<typeof PartSchema>): Part => {
  return create(PartSchema, init)
}
