@file:JvmName("LanguageHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.lowerTag
import gondola.lyrics.model.utils.scoreTag

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
fun <T> pickItemByLanguage(items: List<T>, wanted: String? = null, fallback: Boolean = false, languageOf: (T) -> String?): T? {
    return pickItemByLanguage(items, listOfNotNull(wanted), fallback, languageOf)
}

/**
 * Tries ordered language preferences, ignoring case and matching on subtag boundaries.
 * Within each preference, the closest match wins and ties keep source order; any earlier preference match takes priority over later preferences.
 *
 * Empty preferences are skipped, and an untagged entry is used only after all preferences fail.
 * If no untagged entry exists, the first entry is used only when fallback is enabled.
 * Java uses a distinct method name to keep null calls to the string overload unambiguous.
 */
@JvmName("pickItemByLanguagePreferences")
fun <T> pickItemByLanguage(items: List<T>, wanted: List<String>, fallback: Boolean = false, languageOf: (T) -> String?): T? {
    for (language in wanted) {
        val range = lowerTag(language) ?: continue
        var best: T? = null
        var bestScore = 0
        for (item in items) {
            val tag = lowerTag(languageOf(item))
            val score = if (tag != null) scoreTag(tag, range) else 0
            if (score > bestScore) {
                best = item
                bestScore = score
            }
        }
        if (best != null) {
            return best
        }
    }
    return items.firstOrNull { languageOf(it).isNullOrEmpty() } ?: if (fallback) items.firstOrNull() else null
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickTextByLanguage")
fun pickItemByLanguage(items: List<Text>, wanted: String? = null, fallback: Boolean = false): Text? {
    return pickItemByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects text by ordered language preferences, using an untagged entry after all preferences fail.
 *
 * The first entry is used only when no match or untagged entry exists and fallback is enabled.
 */
@JvmName("pickTextByLanguagePreferences")
fun pickItemByLanguage(items: List<Text>, wanted: List<String>, fallback: Boolean = false): Text? {
    return pickItemByLanguage(items, wanted, fallback) { it.language }
}
