import type { MakeInit } from '@root/utils'
import type { Meta, MetaCredit, MetaReference } from './proto'
import type { Diagnostic } from './diagnostic'

import { CreditRole, MetaCreditSchema, MetaReferenceSchema, MetaSchema, TextSchema, UnknownEntrySchema } from './proto'
import { DiagnosticCode } from './diagnostic'

import { canonicalizeList, checkNumberDomain, childPath, findDuplicates, lowerTag } from '@root/utils'
import { canonicalizeText } from './text'

import { create } from '@bufbuild/protobuf'

/**
 * The schema declares a duration above this bound invalid, matching a time.
 */
const MAX_DURATION = 2 ** 31 - 1

/**
 * The offset is a sint32, so it spans the whole signed 32-bit range.
 */
const MIN_OFFSET = -(2 ** 31)
const MAX_OFFSET = 2 ** 31 - 1

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
 * Validates a Meta: its offset and its duration, when set, must lie within the schema's domain, its titles, albums and references hold one entry per key, and each of its credits must be valid.
 */
export const validateMeta = (meta: Meta, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  /**
   * Reports every entry of one list whose key an earlier entry already took, locating the later one.
   */
  const checkDuplicates = <T>(items: T[], key: (item: T) => string, field: string, code: DiagnosticCode): void => {
    findDuplicates(items, key).forEach((i) => {
      diagnostics.push({ path: childPath(path, `${field}[${i}]`), code })
    })
  }
  const byLanguage = (text: { language?: string }): string => lowerTag(text.language) ?? ''
  const offset = checkNumberDomain(meta.offset, MIN_OFFSET, MAX_OFFSET)
  if (offset === 'invalid') {
    diagnostics.push({ path: childPath(path, 'offset'), code: DiagnosticCode.MetaOffsetInvalid })
  } else if (offset === 'overflow') {
    diagnostics.push({ path: childPath(path, 'offset'), code: DiagnosticCode.MetaOffsetOverflow })
  }
  if (meta.duration !== undefined) {
    const duration = checkNumberDomain(meta.duration, 0, MAX_DURATION)
    if (duration === 'invalid') {
      diagnostics.push({ path: childPath(path, 'duration'), code: DiagnosticCode.MetaDurationInvalid })
    } else if (duration === 'overflow') {
      diagnostics.push({ path: childPath(path, 'duration'), code: DiagnosticCode.MetaDurationOverflow })
    }
  }
  // Titles and albums are one per language, while artists, authors and credited names are one per person, so only the first two are checked.
  checkDuplicates(meta.titles, byLanguage, 'titles', DiagnosticCode.MetaTitlesLanguageDuplicate)
  checkDuplicates(meta.albums, byLanguage, 'albums', DiagnosticCode.MetaAlbumsLanguageDuplicate)
  meta.credits.forEach((credit, i) => diagnostics.push(...validateMetaCredit(credit, childPath(path, `credits[${i}]`))))
  checkDuplicates(meta.references, (reference) => reference.platform.toLowerCase(), 'references', DiagnosticCode.MetaReferencesPlatformDuplicate)
  return diagnostics
}

/**
 * Returns a copy of the credit with its names canonicalized and all-default entries dropped.
 */
export const canonicalizeMetaCredit = (credit: MetaCredit): MetaCredit => {
  return { ...credit, names: canonicalizeList(TextSchema, credit.names, canonicalizeText) }
}

/**
 * Returns a copy of the reference with its platform lowercased and empty ids dropped.
 */
export const canonicalizeMetaReference = (reference: MetaReference): MetaReference => {
  return { ...reference, platform: reference.platform.toLowerCase(), ids: reference.ids.filter((id) => id !== '') }
}

/**
 * Returns a copy of the Meta with its text lists, credits and references canonicalized, all-default unknown entries dropped, and its ISRCs upper-cased without separators.
 */
export const canonicalizeMeta = (meta: Meta): Meta => {
  return {
    ...meta,
    unknowns: canonicalizeList(UnknownEntrySchema, meta.unknowns, (entry) => entry),
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
