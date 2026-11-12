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
    val range = lowerTag(wanted)
    var best: T? = null
    var bestScore = 0
    for (item in items) {
        val tag = lowerTag(languageOf(item))
        val score = if (tag != null && range != null) scoreTag(tag, range) else 0
        if (score > bestScore) {
            best = item
            bestScore = score
        }
    }
    return best ?: items.firstOrNull { languageOf(it).isNullOrEmpty() } ?: if (fallback) items.firstOrNull() else null
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
