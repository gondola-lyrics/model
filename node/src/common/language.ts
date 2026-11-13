import { lowerNonEmptyTag, scoreTag } from '@root/utils'

/**
 * Tries one language or an ordered preference list, ignoring case and matching on subtag boundaries.
 * Within each preference, the closest match wins and ties keep source order; any earlier preference match takes priority over later preferences.
 *
 * Empty preferences are skipped, and an untagged entry is used only after all preferences fail.
 * If no untagged entry exists, the first entry is used only when fallback is enabled.
 */
export const pickItemByLanguage = <T extends { language?: string | undefined }>(
  items: readonly T[],
  wanted?: string | readonly string[],
  fallback = false,
): T | undefined => {
  const preferences = typeof wanted === 'string' ? [wanted] : (wanted ?? [])
  for (const language of preferences) {
    const range = lowerNonEmptyTag(language)
    if (range === undefined) {
      continue
    }
    let best: T | undefined
    let bestScore = 0
    for (const item of items) {
      const tag = lowerNonEmptyTag(item.language)
      const score = tag ? scoreTag(tag, range) : 0
      if (score > bestScore) {
        best = item
        bestScore = score
      }
    }
    if (best !== undefined) {
      return best
    }
  }
  return items.find((item) => !item.language) ?? (fallback ? items[0] : undefined)
}
