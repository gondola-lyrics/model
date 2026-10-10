import type { MakeInit } from '@root/utils'
import type { AnyLineContent, Diagnostic } from '@root/common'
import type { LanguageUsage } from './proto'

import { LineType, WordType } from '@root/common/proto'
import { DiagnosticCode } from '@root/common'
import { LanguageUsageSchema } from './proto'

import { checkNumberDomain, childPath, compareTags, lowerTag } from '@root/utils'
import { isLanguageTag } from '@root/common'
import { create } from '@bufbuild/protobuf'

/**
 * The count is a uint32, so it spans the whole unsigned 32-bit range.
 */
const MAX_COUNT = 2 ** 32 - 1

/**
 * Creates a LanguageUsage, counting the normal lines declaring one language.
 */
export const makeLanguageUsage = (init?: MakeInit<typeof LanguageUsageSchema>): LanguageUsage => {
  return create(LanguageUsageSchema, init)
}

/**
 * Validates a LanguageUsage: its tag must name a language, and its count must lie within the schema's domain.
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
 * Orders language usages into canonical order: descending count, then ascending tag read without case.
 */
export const orderLanguageUsages = (languages: LanguageUsage[]): LanguageUsage[] => {
  return [...languages].sort((a, b) => b.count - a.count || compareTags(a.tag, b.tag))
}

/**
 * Counts language declarations across normal lines, collecting both line tags and normal-word tags even when the line already declares languages.
 * Each lowercased language counts once per line; empty or missing tags are skipped, and only explicitly declared `und` is counted.
 * Spaces, annotations and background lines contribute nothing, and the result is ordered by descending count then ascending tag.
 */
export const deriveLanguageUsages = (lines: { type: LineType; languages?: string[]; content?: AnyLineContent }[]): LanguageUsage[] => {
  const counts = new Map<string, number>()
  for (const line of lines) {
    if (line.type !== LineType.NORMAL) {
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
      if (word.type !== WordType.NORMAL) {
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
 * Canonicalizes a list of usages: tags lowercased, entries sharing a tag merged by summing their counts, entries naming no language dropped, then ordered.
 * A count past the field's bound is capped at it, since summing two entries is how one arises; a value that is no count at all is left as it stands for validate to report.
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
