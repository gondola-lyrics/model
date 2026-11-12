import type { Diagnostic } from '@root/common'
import type { LanguageUsage } from '@root/generated/enriched/index.gen'
import type { MakeInit } from '@root/utils'

import { DiagnosticCode, isLanguageTag } from '@root/common'
import { createEnrichedLanguageUsage } from '@root/generated/detail.gen'
import { LineType as DocumentLineType, WordType as DocumentWordType } from '@root/generated/document/index.gen'
import { LineType, WordType } from '@root/generated/enriched/index.gen'
import { checkNumberDomain, childPath, compareTags, lowerTag, withInit } from '@root/utils'

/**
 * The count field spans the uint32 domain.
 */
const MAX_COUNT = 2 ** 32 - 1
const NORMAL_LINE_TYPES: ReadonlySet<number> = new Set([LineType.NORMAL, DocumentLineType.NORMAL])
const NORMAL_WORD_TYPES: ReadonlySet<number> = new Set([WordType.NORMAL, DocumentWordType.NORMAL])

type LanguageLine = {
  type: number
  languages?: string[] | undefined
  content?: { words: { type: number; language?: string | undefined }[] } | undefined
}

/**
 * Creates a count of normal lines declaring one language.
 */
export const makeLanguageUsage = (init?: MakeInit<LanguageUsage>): LanguageUsage => {
  return withInit(createEnrichedLanguageUsage(), init)
}

/**
 * Checks that the language tag is well formed and the count fits uint32.
 */
export const validateLanguageUsage = (usage: LanguageUsage, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (usage.tag === '') {
    diagnostics.push({ path: childPath(path, 'tag'), code: DiagnosticCode.LanguageUsageTagEmpty })
  } else if (!isLanguageTag(usage.tag)) {
    diagnostics.push({ path: childPath(path, 'tag'), code: DiagnosticCode.LanguageTagMalformed })
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
 * Orders language counts descending, then tags case-insensitively ascending.
 */
export const orderLanguageUsages = (languages: LanguageUsage[]): LanguageUsage[] => {
  return [...languages].sort((a, b) => b.count - a.count || compareTags(a.tag, b.tag))
}

/**
 * Counts each distinct declared tag once per normal line, including its normal words.
 *
 * Spaces, annotations, backgrounds, and absent tags are excluded; explicit und tags are counted.
 */
export const deriveLanguageUsages = (lines: LanguageLine[]): LanguageUsage[] => {
  const counts = new Map<string, number>()
  for (const line of lines) {
    if (!NORMAL_LINE_TYPES.has(line.type)) {
      continue
    }
    const tags = new Set<string>()
    for (const language of line.languages ?? []) {
      const tag = lowerTag(language)
      if (tag) {
        tags.add(tag)
      }
    }
    for (const word of line.content?.words ?? []) {
      if (!NORMAL_WORD_TYPES.has(word.type)) {
        continue
      }
      const tag = lowerTag(word.language)
      if (tag) {
        tags.add(tag)
      }
    }
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return orderLanguageUsages([...counts].map(([tag, count]) => makeLanguageUsage({ tag, count })))
}

/**
 * Lowercases tags, merges duplicate counts, drops untagged entries, and orders the result.
 *
 * Totals above uint32 are capped; invalid counts remain available for validation.
 */
export const canonicalizeLanguageUsages = (languages: LanguageUsage[]): LanguageUsage[] => {
  const counts = new Map<string, number>()
  for (const usage of languages) {
    const tag = lowerTag(usage.tag)
    // An empty tag names no language, so its count counts nothing, and every other list drops an empty entry the same way.
    if (tag === undefined) {
      continue
    }
    counts.set(tag, Math.min((counts.get(tag) ?? 0) + usage.count, MAX_COUNT))
  }
  return orderLanguageUsages([...counts].map(([tag, count]) => makeLanguageUsage({ tag, count })))
}
