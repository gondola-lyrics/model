import type { MakeInit } from '@root/utils'
import type { Part } from '@root/generated/common/index.gen'
import type { Diagnostic } from './diagnostic'

import { PartType } from '@root/generated/common/index.gen'
import { childPath, isUnresolved, assignDefinedFields } from '@root/utils'
import { createCommonPart } from '@root/generated/detail.gen'

import { DiagnosticCode } from './diagnostic'

/**
 * Creates a Part, the structural section a line belongs to.
 */
export const makePart = (init?: MakeInit<Part>): Part => {
  return assignDefinedFields(createCommonPart(), init)
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

/**
 * Checks section id consistency and requires interludes to precede the last sung line.
 * Parts follow the lyric's line order; background lines inherit their parent's part.
 */
export const validateLyricParts = (parts: readonly (Part | undefined)[], lastSungLineIndex: number): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const seen = new Map<string, { part: Part; lastIndex: number }>()
  parts.forEach((part, i) => {
    if (part?.type === PartType.INTERLUDE && i >= lastSungLineIndex) {
      diagnostics.push({ path: `lines[${i}].part.type`, code: DiagnosticCode.LyricPartInterludeTrailing })
    }
    if (part?.id === undefined || part.id === '') {
      return
    }
    const previous = seen.get(part.id)
    if (previous === undefined) {
      seen.set(part.id, { part, lastIndex: i })
      return
    }
    if (part.type !== previous.part.type || part.raw !== previous.part.raw) {
      diagnostics.push({ path: `lines[${i}].part`, code: DiagnosticCode.LyricPartMismatch })
    }
    if (previous.lastIndex !== i - 1) {
      diagnostics.push({ path: `lines[${i}].part.id`, code: DiagnosticCode.LyricPartIdReused })
    }
    previous.lastIndex = i
  })
  return diagnostics
}
