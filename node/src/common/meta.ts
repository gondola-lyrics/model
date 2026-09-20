import type { MakeInit } from '@root/utils'
import type { Meta, MetaCredit, MetaReference } from './proto'
import type { Diagnostic } from './diagnostic'

import { CreditRole, MetaCreditSchema, MetaReferenceSchema, MetaSchema, TextSchema } from './proto'
import { DiagnosticCode } from './diagnostic'

import { canonicalizeList } from '@root/utils'
import { canonicalizeText } from './text'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a Meta, the lyric's metadata.
 */
export const makeMeta = (init?: MakeInit<typeof MetaSchema>): Meta => {
  return create(MetaSchema, init)
}

/**
 * Creates a MetaCredit, one credited role and the names filling it.
 */
export const makeMetaCredit = (init?: MakeInit<typeof MetaCreditSchema>): MetaCredit => {
  return create(MetaCreditSchema, init)
}

/**
 * Creates a MetaReference, an external platform id for the lyric.
 */
export const makeMetaReference = (init?: MakeInit<typeof MetaReferenceSchema>): MetaReference => {
  return create(MetaReferenceSchema, init)
}

/**
 * Validates a MetaCredit: an OTHER role must carry the source's own word in `raw`.
 */
export const validateMetaCredit = (credit: MetaCredit, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (credit.role === CreditRole.OTHER && credit.raw === undefined) {
    diagnostics.push({ path, code: DiagnosticCode.MetaCreditRawMissing })
  }
  return diagnostics
}

/**
 * Returns a copy of the credit with its names canonicalized and all-default entries dropped.
 */
export const canonicalizeMetaCredit = (credit: MetaCredit): MetaCredit => {
  return { ...credit, names: canonicalizeList(TextSchema, credit.names, canonicalizeText) }
}

/**
 * Returns a copy of the reference with its platform lowercased.
 */
export const canonicalizeMetaReference = (reference: MetaReference): MetaReference => {
  return { ...reference, platform: reference.platform.toLowerCase() }
}

/**
 * Returns a copy of the Meta with its text lists, credits and references canonicalized and its ISRCs upper-cased without separators.
 */
export const canonicalizeMeta = (meta: Meta): Meta => {
  return {
    ...meta,
    titles: canonicalizeList(TextSchema, meta.titles, canonicalizeText),
    artists: canonicalizeList(TextSchema, meta.artists, canonicalizeText),
    albums: canonicalizeList(TextSchema, meta.albums, canonicalizeText),
    authors: canonicalizeList(TextSchema, meta.authors, canonicalizeText),
    isrcs: meta.isrcs.map((isrc) => isrc.replace(/[^0-9a-zA-Z]/g, '').toUpperCase()).filter((isrc) => isrc !== ''),
    credits: canonicalizeList(MetaCreditSchema, meta.credits, canonicalizeMetaCredit),
    references: canonicalizeList(MetaReferenceSchema, meta.references, canonicalizeMetaReference),
  }
}

/**
 * Applies a timeline offset to a playback clock, yielding the value to compare against stored times.
 * A positive offset makes the lyric appear earlier.
 * Compute in signed 64-bit, since a uint32 clock plus a sint32 offset overflows unsigned arithmetic.
 */
export const applyOffset = (clock: number, offset: number): number => {
  return clock + offset
}

/**
 * Removes a timeline offset from a stored time, yielding the playback clock at which it is reached.
 * This inverts applyOffset.
 * The result may be negative, meaning before playback starts.
 */
export const removeOffset = (time: number, offset: number): number => {
  return time - offset
}
