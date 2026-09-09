import type { MakeInit } from '@root/utils'
import type { Lyric } from './proto'

import { LyricSchema } from './proto'
import { SCHEMA_VERSION } from '@root/version'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a storage Lyric, stamping the current schema version over any version in init.
 */
export const makeLyric = (init?: Omit<MakeInit<typeof LyricSchema>, 'version'>): Lyric => {
  return create(LyricSchema, { ...init, version: SCHEMA_VERSION })
}
