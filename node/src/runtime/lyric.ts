import type { MakeInit } from '@root/utils'
import type { Lyric } from './proto'

import { LyricSchema, LyricStatus } from './proto'
import { SCHEMA_VERSION } from '@root/version'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a runtime Lyric, stamping the current schema version over any version in init.
 * status must be VALID or INVALID; UNSPECIFIED is rejected at compile time, and the caller flips it as parsing resolves.
 */
export const makeLyric = (
  init: Omit<MakeInit<typeof LyricSchema>, 'version' | 'status'> & {
    status: LyricStatus.VALID | LyricStatus.INVALID
  },
): Lyric => {
  return create(LyricSchema, { ...init, version: SCHEMA_VERSION })
}
