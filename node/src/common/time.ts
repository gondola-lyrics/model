import type { MakeInit } from '@root/utils'
import type { TimeRange } from './proto'
import type { Diagnostic } from './diagnostic'

import { MAX_TIME, checkNumberDomain } from '@root/utils'
import { TimeRangeSchema } from './proto'
import { DiagnosticCode } from './diagnostic'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a TimeRange, the half-open range [start, end).
 */
export const makeTimeRange = (init?: MakeInit<typeof TimeRangeSchema>): TimeRange => {
  return create(TimeRangeSchema, init)
}

/**
 * Validates a TimeRange: neither bound may hold a value outside the schema's domain, and when both hold a usable one the end may not fall before the start.
 */
export const validateTimeRange = (range: TimeRange, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const start = checkNumberDomain(range.start, 0, MAX_TIME)
  const end = checkNumberDomain(range.end, 0, MAX_TIME)
  if (start === 'ok' && end === 'ok' && range.end < range.start) {
    diagnostics.push({ path, code: DiagnosticCode.TimeRangeEndBeforeStart })
  }
  if (start === 'invalid') {
    diagnostics.push({ path, code: DiagnosticCode.TimeRangeStartInvalid })
  } else if (start === 'overflow') {
    diagnostics.push({ path, code: DiagnosticCode.TimeRangeStartOverflow })
  }
  if (end === 'invalid') {
    diagnostics.push({ path, code: DiagnosticCode.TimeRangeEndInvalid })
  } else if (end === 'overflow') {
    diagnostics.push({ path, code: DiagnosticCode.TimeRangeEndOverflow })
  }
  return diagnostics
}

/**
 * Returns the length of a TimeRange in milliseconds, or undefined when it is unset.
 * Compute it signed, so an invalid end below start yields a negative length instead of wrapping around.
 */
export const getTimeRangeDuration = (range: TimeRange | undefined): number | undefined => {
  return range ? range.end - range.start : undefined
}

/**
 * Returns how far `at` has progressed through a TimeRange: 0 before its start, 1 from its end on, or undefined when the TimeRange is unset.
 * A zero-length range therefore jumps from 0 to 1 at its start.
 */
export const getTimeRangeProgress = (range: TimeRange | undefined, at: number): number | undefined => {
  if (!range) {
    return undefined
  }
  if (at < range.start) {
    return 0
  }
  if (at >= range.end) {
    return 1
  }
  return (at - range.start) / (range.end - range.start)
}

/**
 * Reports whether `at` falls inside a TimeRange, which includes its start but not its end, so a zero-length range never does.
 * An unset TimeRange is never active.
 */
export const isTimeRangeActive = (range: TimeRange | undefined, at: number): boolean => {
  return range !== undefined && range.start <= at && at < range.end
}
