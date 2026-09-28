import type { MakeInit } from '@root/utils'
import type { LanguageUsage } from './proto'

import { LanguageUsageSchema } from './proto'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a LanguageUsage, one language's weighted unit count across the lyric; the tag is lowercased.
 */
export const makeLanguageUsage = (init?: MakeInit<typeof LanguageUsageSchema>): LanguageUsage => {
  return create(LanguageUsageSchema, { ...init, tag: init?.tag?.toLowerCase() })
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
