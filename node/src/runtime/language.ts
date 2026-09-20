import type { MakeInit } from '@root/utils'
import type { LanguageUsage } from './proto'

import { LanguageUsageSchema } from './proto'

import { create } from '@bufbuild/protobuf'

/**
 * Creates a LanguageUsage, one language's weighted unit count across the lyric.
 */
export const makeLanguageUsage = (init?: MakeInit<typeof LanguageUsageSchema>): LanguageUsage => {
  return create(LanguageUsageSchema, init)
}

/**
 * Orders language usages into canonical order: descending count, then ascending tag.
 */
export const orderLanguageUsages = (languages: LanguageUsage[]): LanguageUsage[] => {
  return [...languages].sort((a, b) => b.count - a.count || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
}
