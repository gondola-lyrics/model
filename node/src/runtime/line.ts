import type { MakeInit } from '@root/utils'
import type { Line, LineBackground } from './proto'

import { LineType } from '@root/common/proto'
import { LineBackgroundSchema, LineSchema } from './proto'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a normal line, stamping LINE_TYPE_NORMAL so the discriminant can never be set from outside.
 */
export const makeLineNormal = (init: Omit<MakeInit<typeof LineSchema>, 'type'>): Line => {
  return create(LineSchema, { ...init, type: LineType.NORMAL })
}

/**
 * Creates an instrumental line, stamping LINE_TYPE_INSTRUMENTAL and carrying only a time range and optional part.
 * A present part means the source stated the stretch; its absence means it was derived from a gap in the timeline.
 */
export const makeLineInstrumental = (init?: Pick<MakeInit<typeof LineSchema>, 'time' | 'part'>): Line => {
  return create(LineSchema, { ...init, type: LineType.INSTRUMENTAL })
}

/**
 * Creates a LineBackground, a background vocal line attached to a normal line.
 */
export const makeLineBackground = (init?: MakeInit<typeof LineBackgroundSchema>): LineBackground => {
  return create(LineBackgroundSchema, init)
}
