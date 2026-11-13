import { lowerTag } from '@root/utils'

import { pickItemByLanguage } from './language'

/**
 * Scheme filtering is applied before language preferences and their fallback.
 */
export type SchemePreference = {
  /**
   * Unset means unrestricted; an empty string selects candidates without a scheme.
   */
  scheme?: string | undefined
  /**
   * Earlier language preferences take priority over later ones.
   */
  languages?: string | readonly string[] | undefined
  /**
   * Allows the first candidate within the requested scheme when no language match or untagged entry exists.
   */
  fallback?: boolean | undefined
}

/**
 * Filters schemes case-insensitively, then selects by ordered language preferences.
 *
 * Unset scheme imposes no filter; an empty scheme selects unset or empty schemes.
 * Language fallback stays within the filtered candidates, and the selected item is returned unchanged.
 */
export const pickItemByScheme = <T extends { language?: string | undefined; scheme?: string | undefined }>(
  items: readonly T[],
  preference: SchemePreference = {},
): T | undefined => {
  const scheme = lowerTag(preference.scheme)
  const candidates = preference.scheme === undefined ? items : items.filter((item) => lowerTag(item.scheme) === scheme)
  return pickItemByLanguage(candidates, preference.languages, preference.fallback ?? false)
}
