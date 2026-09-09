import type { MakeInit } from '@root/utils'
import type { Text } from './proto'

import { TextSchema } from './proto'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a Text, content with an optional BCP 47 language tag.
 */
export const makeText = (init?: MakeInit<typeof TextSchema>): Text => {
  return create(TextSchema, init)
}
