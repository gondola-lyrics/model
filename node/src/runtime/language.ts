import type { MakeInit } from '@root/utils'
import type { Diagnostic } from '@root/common'
import type { LanguageUsage } from './proto'

import { DiagnosticCode } from '@root/common'
import { LanguageUsageSchema } from './proto'

import { checkNumberDomain, childPath } from '@root/utils'

import { create } from '@bufbuild/protobuf'

/**
 * The count is a uint32, so it spans the whole unsigned 32-bit range.
 */
const MAX_COUNT = 2 ** 32 - 1

/**
 * Creates a LanguageUsage, one language's weighted unit count across the lyric; the tag is lowercased.
 */
export const makeLanguageUsage = (init?: MakeInit<typeof LanguageUsageSchema>): LanguageUsage => {
  return create(LanguageUsageSchema, { ...init, tag: init?.tag?.toLowerCase() })
}

/**
 * Validates a LanguageUsage: its tag must name a language, and its count must lie within the schema's domain.
 */
export const validateLanguageUsage = (usage: LanguageUsage, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (usage.tag === '') {
    diagnostics.push({ path: childPath(path, 'tag'), code: DiagnosticCode.LanguageUsageTagEmpty })
  }
  const count = checkNumberDomain(usage.count, 0, MAX_COUNT)
  if (count === 'invalid') {
    diagnostics.push({ path: childPath(path, 'count'), code: DiagnosticCode.LanguageUsageCountInvalid })
  } else if (count === 'overflow') {
    diagnostics.push({ path: childPath(path, 'count'), code: DiagnosticCode.LanguageUsageCountOverflow })
  }
  return diagnostics
}

/**
 * Orders language usages into canonical order: descending count, then ascending tag.
 */
export const orderLanguageUsages = (languages: LanguageUsage[]): LanguageUsage[] => {
  return [...languages].sort((a, b) => b.count - a.count || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
}

/**
 * Returns a copy of the usage with its tag lowercased.
 */
export const canonicalizeLanguageUsage = (usage: LanguageUsage): LanguageUsage => {
  return { ...usage, tag: usage.tag.toLowerCase() }
}

/**
 * Canonicalizes a list of usages: tags lowercased, entries sharing a tag merged by summing their counts, all-default entries dropped, then ordered.
 */
export const canonicalizeLanguageUsages = (languages: LanguageUsage[]): LanguageUsage[] => {
  const counts = new Map<string, number>()
  for (const usage of languages) {
    const tag = usage.tag.toLowerCase()
    counts.set(tag, (counts.get(tag) ?? 0) + usage.count)
  }
  const merged = [...counts].filter(([tag, count]) => tag !== '' || count !== 0).map(([tag, count]) => makeLanguageUsage({ tag, count }))
  return orderLanguageUsages(merged)
}
