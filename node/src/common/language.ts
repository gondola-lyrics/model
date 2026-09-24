import { lowerTag, scoreTag } from '@root/utils'

/**
 * Picks the entry whose language matches `wanted` most closely: an exact match first, then the longest shared prefix, with ties going to the earlier entry.
 * Tags compare case-insensitively on subtag boundaries, and either side may be the more specific one, so `ja` picks `ja-JP` while `zh-Hans` never picks `zh-CN`.
 * With no match, or no `wanted`, it returns the first entry carrying no language, else the first entry only if `fallback` is set.
 */
export const pickItemByLanguage = <T extends { language?: string }>(items: T[], wanted?: string, fallback = false): T | undefined => {
  const range = lowerTag(wanted)
  let best: T | undefined
  let bestScore = 0
  for (const item of items) {
    const tag = lowerTag(item.language)
    const score = tag && range ? scoreTag(tag, range) : 0
    if (score > bestScore) {
      best = item
      bestScore = score
    }
  }
  return best ?? items.find((item) => !item.language) ?? (fallback ? items[0] : undefined)
}
