import type { MakeInit } from '@root/utils'
import type { Part } from './proto'
import type { Diagnostic } from './diagnostic'

import { PartSchema, PartType } from './proto'
import { DiagnosticCode } from './diagnostic'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a Part, the structural section a line belongs to.
 */
export const makePart = (init?: MakeInit<typeof PartSchema>): Part => {
  return create(PartSchema, init)
}

/**
 * Validates a Part: an OTHER type must carry the source's own word in `raw`.
 */
export const validatePart = (part: Part, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (part.type === PartType.OTHER && part.raw === undefined) {
    diagnostics.push({ path, code: DiagnosticCode.PartRawMissing })
  }
  return diagnostics
}
