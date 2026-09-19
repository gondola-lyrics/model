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
