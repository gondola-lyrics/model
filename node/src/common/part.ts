import type { MakeInit } from '@root/utils'
import type { Part } from './proto'
import type { Diagnostic } from './diagnostic'

import { PartSchema, PartType, PartTypeSchema } from './proto'
import { DiagnosticCode } from './diagnostic'

import { childPath, isUnresolved } from '@root/utils'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a Part, the structural section a line belongs to.
 */
export const makePart = (init?: MakeInit<typeof PartSchema>): Part => {
  return create(PartSchema, init)
}

/**
 * Validates a Part: its type must be resolved, and an OTHER type must carry the source's own word in `raw`.
 * An unresolved type makes no section at all, so `raw` is asked for only once the type says which section it named.
 */
export const validatePart = (part: Part, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (isUnresolved(PartTypeSchema, part.type)) {
    diagnostics.push({ path: childPath(path, 'type'), code: DiagnosticCode.PartTypeUnspecified })
  } else if (part.type === PartType.OTHER && part.raw === undefined) {
    diagnostics.push({ path, code: DiagnosticCode.PartRawMissing })
  }
  return diagnostics
}
