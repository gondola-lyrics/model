import type { MakeInit } from '@root/utils'
import type { Meta, MetaCredit, MetaReference } from '@root/generated/common/index.gen'
import type { Diagnostic } from './diagnostic'

import { CreditRole } from '@root/generated/common/index.gen'
import {
  fieldsCommonMeta,
  fieldsCommonMetaCredit,
  fieldsCommonMetaReference,
  fieldsCommonText,
  fieldsCommonUnknownEntry,
  createCommonMeta,
  createCommonMetaCredit,
  createCommonMetaReference,
} from '@root/generated/detail.gen'
import {
  canonicalizeList,
  classifyNumberDomain,
  childPath,
  findDefaultEntries,
  findDuplicateIndices,
  isUnresolved,
  lowerNonEmptyTag,
  assignDefinedFields,
} from '@root/utils'

import { DiagnosticCode } from './diagnostic'
import { validateLanguageTag } from './tag'
import { canonicalizeText, validateText } from './text'

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
 * Country, registrant, year, and designation make up the ISRC shape; assignment is not checked.
 */
const ISRC_PATTERN = /^[A-Z]{2}[0-9A-Z]{3}[0-9]{7}$/

/**
 * Ignores case and separators when checking the ISRC shape.
 */
const hasIsrcShape = (isrc: string): boolean => {
  return ISRC_PATTERN.test(isrc.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())
}

/**
 * Creates a Meta, the lyric's metadata.
 */
export const makeMeta = (init?: MakeInit<Meta>): Meta => {
  return assignDefinedFields(createCommonMeta(), init)
}

/**
 * Creates a MetaCredit, one credited role and the names filling it.
 */
export const makeMetaCredit = (init?: MakeInit<MetaCredit>): MetaCredit => {
  return assignDefinedFields(createCommonMetaCredit(), init)
}

/**
 * Creates a MetaReference, an external platform id for the lyric.
 */
export const makeMetaReference = (init?: MakeInit<MetaReference>): MetaReference => {
  return assignDefinedFields(createCommonMetaReference(), init)
}

/**
 * Validates a MetaCredit: its role must be resolved, and an OTHER role must carry the source's own word in `raw`.
 * An unresolved role makes no credit at all, so `raw` is asked for only once the role says which one it named.
 */
export const validateMetaCredit = (credit: MetaCredit, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (isUnresolved(CreditRole, credit.role)) {
    diagnostics.push({ path: childPath(path, 'role'), code: DiagnosticCode.MetaCreditRoleUnspecified })
  } else if (credit.role === CreditRole.OTHER && credit.raw === undefined) {
    diagnostics.push({ path, code: DiagnosticCode.MetaCreditRawMissing })
  }
  credit.names.forEach((name, i) => diagnostics.push(...validateText(name, childPath(path, `names[${i}]`))))
  return diagnostics
}

/**
 * Checks the platform and requires at least one non-empty identifier.
 *
 * Paths are relative to this reference unless its location is supplied.
 */
export const validateMetaReference = (reference: MetaReference, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (reference.platform === '') {
    diagnostics.push({ path: childPath(path, 'platform'), code: DiagnosticCode.MetaReferencePlatformEmpty })
  }
  if (reference.ids.length === 0) {
    diagnostics.push({ path: childPath(path, 'ids'), code: DiagnosticCode.MetaReferenceIdsEmpty })
  }
  findDefaultEntries(
    fieldsCommonMetaReference,
    reference,
    diagnostics.map((diagnostic) => diagnostic.path),
    path,
  ).forEach((entryPath) => {
    diagnostics.push({ path: entryPath, code: DiagnosticCode.LyricListEntryEmpty })
  })
  return diagnostics
}

/**
 * Checks metadata values, language tags, list uniqueness, and child entries.
 *
 * Paths are relative to this metadata unless its location is supplied.
 */
export const validateMeta = (meta: Meta, path = ''): Diagnostic[] => {
  const diagnostics = validateLanguageTag(meta.language, childPath(path, 'language'))
  /**
   * Reports every entry of one list whose key an earlier entry already took, locating the later one.
   */
  const checkDuplicates = <T>(items: T[], key: (item: T) => string, field: string, code: DiagnosticCode): void => {
    findDuplicateIndices(items, key).forEach((i) => {
      diagnostics.push({ path: childPath(path, `${field}[${i}]`), code })
    })
  }
  const byLanguage = (text: { language?: string | undefined }): string => {
    return lowerNonEmptyTag(text.language) ?? ''
  }
  const offset = classifyNumberDomain(meta.offset, MIN_OFFSET, MAX_OFFSET)
  if (offset === 'invalid') {
    diagnostics.push({ path: childPath(path, 'offset'), code: DiagnosticCode.MetaOffsetInvalid })
  } else if (offset === 'overflow') {
    diagnostics.push({ path: childPath(path, 'offset'), code: DiagnosticCode.MetaOffsetOverflow })
  }
  if (meta.duration !== undefined) {
    const duration = classifyNumberDomain(meta.duration, 0, MAX_DURATION)
    if (duration === 'invalid') {
      diagnostics.push({ path: childPath(path, 'duration'), code: DiagnosticCode.MetaDurationInvalid })
    } else if (duration === 'overflow') {
      diagnostics.push({ path: childPath(path, 'duration'), code: DiagnosticCode.MetaDurationOverflow })
    }
  }
  // Titles and albums are one per language, while artists, authors and credited names are one per person, so only the first two are checked.
  checkDuplicates(meta.titles, byLanguage, 'titles', DiagnosticCode.MetaTitlesLanguageDuplicate)
  checkDuplicates(meta.albums, byLanguage, 'albums', DiagnosticCode.MetaAlbumsLanguageDuplicate)
  // Every list of text names something, whatever it is keyed by, so each entry is asked for its own text.
  for (const field of ['titles', 'artists', 'albums', 'authors'] as const) {
    meta[field].forEach((text, i) => diagnostics.push(...validateText(text, childPath(path, `${field}[${i}]`))))
  }
  // An ISRC is read by other catalogues, so one outside the shape they read names no recording; which case and separators it is written with is canonical form rather than shape.
  meta.isrcs.forEach((isrc, i) => {
    if (isrc !== '' && !hasIsrcShape(isrc)) {
      diagnostics.push({ path: childPath(path, `isrcs[${i}]`), code: DiagnosticCode.MetaIsrcsMalformed })
    }
  })
  meta.credits.forEach((credit, i) => diagnostics.push(...validateMetaCredit(credit, childPath(path, `credits[${i}]`))))
  checkDuplicates(meta.references, (reference) => reference.platform.toLowerCase(), 'references', DiagnosticCode.MetaReferencesPlatformDuplicate)
  meta.references.forEach((reference, i) => diagnostics.push(...validateMetaReference(reference, childPath(path, `references[${i}]`))))
  findDefaultEntries(
    fieldsCommonMeta,
    meta,
    diagnostics.map((diagnostic) => diagnostic.path),
    path,
  ).forEach((entryPath) => {
    diagnostics.push({ path: entryPath, code: DiagnosticCode.LyricListEntryEmpty })
  })
  return diagnostics
}

/**
 * Returns a copy of the credit with its names canonicalized and all-default entries dropped.
 */
export const canonicalizeMetaCredit = (credit: MetaCredit): MetaCredit => {
  return { ...credit, names: canonicalizeList(fieldsCommonText, credit.names, canonicalizeText) }
}

/**
 * Returns a copy of the reference with its platform lowercased and empty ids dropped.
 */
export const canonicalizeMetaReference = (reference: MetaReference): MetaReference => {
  return { ...reference, platform: reference.platform.toLowerCase(), ids: reference.ids.filter((id) => id !== '') }
}

/**
 * Returns a copy of the Meta with its language tag lowercased, its text lists, credits and references canonicalized, all-default unknown entries dropped, and its ISRCs upper-cased without separators.
 */
export const canonicalizeMeta = (meta: Meta): Meta => {
  return {
    ...meta,
    unknowns: canonicalizeList(fieldsCommonUnknownEntry, meta.unknowns, (entry) => ({ ...entry })),
    language: lowerNonEmptyTag(meta.language),
    titles: canonicalizeList(fieldsCommonText, meta.titles, canonicalizeText),
    artists: canonicalizeList(fieldsCommonText, meta.artists, canonicalizeText),
    albums: canonicalizeList(fieldsCommonText, meta.albums, canonicalizeText),
    authors: canonicalizeList(fieldsCommonText, meta.authors, canonicalizeText),
    isrcs: meta.isrcs.map((isrc) => isrc.replace(/[^0-9a-zA-Z]/g, '').toUpperCase()).filter((isrc) => isrc !== ''),
    credits: canonicalizeList(fieldsCommonMetaCredit, meta.credits, canonicalizeMetaCredit),
    references: canonicalizeList(fieldsCommonMetaReference, meta.references, canonicalizeMetaReference),
  }
}

/**
 * Applies a timeline offset to a playback clock, yielding the value to compare against stored times.
 * A positive offset makes the lyric appear earlier.
 * Compute in signed 64-bit, since a uint32 clock plus a sint32 offset overflows unsigned arithmetic.
 */
export const applyTimeOffset = (clock: number, offset: number): number => {
  return clock + offset
}

/**
 * Removes a timeline offset from a stored time, yielding the playback clock at which it is reached.
 * This inverts applyTimeOffset.
 * The result may be negative, meaning before playback starts.
 */
export const removeTimeOffset = (time: number, offset: number): number => {
  return time - offset
}
