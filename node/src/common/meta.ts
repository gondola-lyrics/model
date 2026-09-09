import type { MakeInit } from '@root/utils'
import type { Meta, MetaCredit, MetaReference } from './proto'

import { MetaCreditSchema, MetaReferenceSchema, MetaSchema } from './proto'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a Meta, the lyric's metadata.
 */
export const makeMeta = (init?: MakeInit<typeof MetaSchema>): Meta => {
  return create(MetaSchema, init)
}

/**
 * Creates a MetaCredit, one credited role and the names filling it.
 */
export const makeMetaCredit = (init?: MakeInit<typeof MetaCreditSchema>): MetaCredit => {
  return create(MetaCreditSchema, init)
}

/**
 * Creates a MetaReference, an external platform id for the lyric.
 */
export const makeMetaReference = (init?: MakeInit<typeof MetaReferenceSchema>): MetaReference => {
  return create(MetaReferenceSchema, init)
}
