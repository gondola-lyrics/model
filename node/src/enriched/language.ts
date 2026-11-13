import type { Diagnostic } from '@root/common'
import type { LanguageUsage } from '@root/generated/enriched/index.gen'
import type { MakeInit } from '@root/utils'

import { DiagnosticCode, isWellFormedLanguageTag } from '@root/common'
import { classifyNumberDomain, childPath, compareTags, lowerNonEmptyTag, assignDefinedFields } from '@root/utils'
import { createEnrichedLanguageUsage } from '@root/generated/detail.gen'
import { LineType as DocumentLineType, WordType as DocumentWordType } from '@root/generated/document/index.gen'
import { LineType, WordType } from '@root/generated/enriched/index.gen'

/**
 * Line counts use the full uint32 range.
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
 * Creates a language usage measured in normal lines.
 */
export const makeEnrichedLanguageUsage = (init?: MakeInit<LanguageUsage>): LanguageUsage => {
  return assignDefinedFields(createEnrichedLanguageUsage(), init)
}

/**
 * Checks that the language tag is well formed and the line count fits uint32.
 */
export const validateEnrichedLanguageUsage = (usage: LanguageUsage, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (usage.tag === '') {
    diagnostics.push({ path: childPath(path, 'tag'), code: DiagnosticCode.LanguageUsageTagEmpty })
  } else if (!isWellFormedLanguageTag(usage.tag)) {
    diagnostics.push({ path: childPath(path, 'tag'), code: DiagnosticCode.LanguageTagMalformed })
  }
  const domain = classifyNumberDomain(usage.lineCount, 0, MAX_COUNT)
  if (domain === 'invalid') {
    diagnostics.push({ path: childPath(path, 'lineCount'), code: DiagnosticCode.LanguageUsageLineCountInvalid })
  } else if (domain === 'overflow') {
    diagnostics.push({ path: childPath(path, 'lineCount'), code: DiagnosticCode.LanguageUsageLineCountOverflow })
  }
  return diagnostics
}

/**
 * Orders non-negative integer counts descending, then tags case-insensitively ascending.
 *
 * Invalid counts follow in source order.
 */
export const orderEnrichedLanguageUsages = (languageUsages: LanguageUsage[]): LanguageUsage[] => {
  return [...languageUsages].sort((a, b) => {
    const aInvalid = classifyNumberDomain(a.lineCount, 0, MAX_COUNT) === 'invalid'
    const bInvalid = classifyNumberDomain(b.lineCount, 0, MAX_COUNT) === 'invalid'
    if (aInvalid) {
      return bInvalid ? 0 : 1
    }
    if (bInvalid) {
      return -1
    }
    return b.lineCount - a.lineCount || compareTags(a.tag, b.tag)
  })
}

/**
 * Counts each distinct declared tag once per normal line, including its normal words.
 *
 * Spaces, annotations, backgrounds, and absent tags are excluded; explicit und tags are counted.
 * Multilingual lines contribute to multiple tags, so total counts may exceed the number of normal lines.
 */
export const deriveEnrichedLanguageUsages = (lines: LanguageLine[]): LanguageUsage[] => {
  const counts = new Map<string, number>()
  for (const line of lines) {
    if (!NORMAL_LINE_TYPES.has(line.type)) {
      continue
    }
    const tags = new Set<string>()
    for (const language of line.languages ?? []) {
      const tag = lowerNonEmptyTag(language)
      if (tag) {
        tags.add(tag)
      }
    }
    for (const word of line.content?.words ?? []) {
      if (!NORMAL_WORD_TYPES.has(word.type)) {
        continue
      }
      const tag = lowerNonEmptyTag(word.language)
      if (tag) {
        tags.add(tag)
      }
    }
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return orderEnrichedLanguageUsages([...counts].map(([tag, lineCount]) => makeEnrichedLanguageUsage({ tag, lineCount })))
}

/**
 * Lowercases tags, merges non-negative integer counts, drops untagged entries, and orders the result.
 *
 * Integer overflow is capped at uint32; invalid counts remain separate at the end in source order.
 */
export const canonicalizeEnrichedLanguageUsages = (languageUsages: LanguageUsage[]): LanguageUsage[] => {
  const counts = new Map<string, number>()
  const invalid: LanguageUsage[] = []
  for (const usage of languageUsages) {
    const tag = lowerNonEmptyTag(usage.tag)
    // Untagged entries cannot contribute to any language's line count.
    if (tag === undefined) {
      continue
    }
    if (classifyNumberDomain(usage.lineCount, 0, MAX_COUNT) === 'invalid') {
      invalid.push({ ...usage, tag })
      continue
    }
    const lineCount = Math.min(usage.lineCount, MAX_COUNT)
    counts.set(tag, Math.min((counts.get(tag) ?? 0) + lineCount, MAX_COUNT))
  }
  const merged = [...counts].map(([tag, lineCount]) => makeEnrichedLanguageUsage({ tag, lineCount }))
  return orderEnrichedLanguageUsages([...merged, ...invalid])
}
