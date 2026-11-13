@file:JvmName("SchemeHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.lowerNonEmptyTag

/**
 * Scheme filtering is applied before language preferences and their fallback.
 *
 * A null scheme imposes no filter; an empty scheme selects candidates without a scheme.
 */
data class SchemePreference(val scheme: String? = null, val languages: List<String> = emptyList(), val fallback: Boolean = false) {
    /**
     * Uses a single language as the ordered preference list.
     */
    constructor(scheme: String? = null, languages: String, fallback: Boolean = false) : this(scheme, listOf(languages), fallback)
}

/**
 * Filters schemes case-insensitively, then selects by ordered language preferences.
 *
 * An empty scheme matches null or empty candidate schemes.
 * Language fallback stays within the filtered candidates, and the selected item is returned unchanged.
 */
fun <T> pickItemByScheme(
    items: List<T>,
    preference: SchemePreference = SchemePreference(),
    languageOf: (T) -> String?,
    schemeOf: (T) -> String?,
): T? {
    val scheme = lowerNonEmptyTag(preference.scheme)
    val candidates = if (preference.scheme == null) items else items.filter { lowerNonEmptyTag(schemeOf(it)) == scheme }
    return pickItemByLanguage(candidates, preference.languages, preference.fallback, languageOf)
}
