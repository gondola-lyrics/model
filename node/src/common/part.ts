import type { MakeInit } from '@root/utils'
import type { Part } from '@root/generated/common/index.gen'
import type { Diagnostic } from './diagnostic'

import { PartType } from '@root/generated/common/index.gen'
import { DiagnosticCode } from './diagnostic'

import { childPath, isUnresolved, withInit } from '@root/utils'
import { createCommonPart } from '@root/generated/internal.gen'

/**
 * Creates a Part, the structural section a line belongs to.
 */
export const makePart = (init?: MakeInit<Part>): Part => {
  return withInit(createCommonPart(), init)
}

/**
 * Validates a Part: its type must be resolved, and an OTHER type must carry the source's own word in `raw`.
 * An unresolved type makes no section at all, so `raw` is asked for only once the type says which section it named.
 */
export const validatePart = (part: Part, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (isUnresolved(PartType, part.type)) {
    diagnostics.push({ path: childPath(path, 'type'), code: DiagnosticCode.PartTypeUnspecified })
  } else if (part.type === PartType.OTHER && part.raw === undefined) {
    diagnostics.push({ path, code: DiagnosticCode.PartRawMissing })
  }
  return diagnostics
}
