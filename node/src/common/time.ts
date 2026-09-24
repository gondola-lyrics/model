import type { MakeInit } from '@root/utils'
import type { Time } from './proto'
import type { Diagnostic } from './diagnostic'

import { TimeSchema } from './proto'
import { DiagnosticCode } from './diagnostic'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a Time, the half-open range [start, end).
 */
export const makeTime = (init?: MakeInit<typeof TimeSchema>): Time => {
  return create(TimeSchema, init)
}

// The schema declares times above this bound invalid.
const MAX_TIME = 2 ** 31 - 1

/**
 * Validates a Time: its end may not fall before its start, and neither bound may exceed 2^31-1.
 */
export const validateTime = (time: Time, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (time.end < time.start) {
    diagnostics.push({ path, code: DiagnosticCode.TimeEndBeforeStart })
  }
  if (time.start > MAX_TIME) {
    diagnostics.push({ path, code: DiagnosticCode.TimeStartOverflow })
  }
  if (time.end > MAX_TIME) {
    diagnostics.push({ path, code: DiagnosticCode.TimeEndOverflow })
  }
  return diagnostics
}

/**
 * Returns the length of a Time in milliseconds, or undefined when it is unset.
 * Compute it signed, so an invalid end below start yields a negative length instead of wrapping around.
 */
export const getTimeDuration = (time: Time | undefined): number | undefined => {
  return time ? time.end - time.start : undefined
}

/**
 * Returns how far `at` has progressed through a Time: 0 before its start, 1 from its end on, or undefined when the Time is unset.
 * A zero-length range therefore jumps from 0 to 1 at its start.
 */
export const getTimeProgress = (time: Time | undefined, at: number): number | undefined => {
  if (!time) {
    return undefined
  }
  if (at < time.start) {
    return 0
  }
  if (at >= time.end) {
    return 1
  }
  return (at - time.start) / (time.end - time.start)
}

/**
 * Reports whether `at` falls inside a Time, which includes its start but not its end, so a zero-length range never does.
 * An unset Time is never active.
 */
export const isTimeActive = (time: Time | undefined, at: number): boolean => {
  return time !== undefined && time.start <= at && at < time.end
}
