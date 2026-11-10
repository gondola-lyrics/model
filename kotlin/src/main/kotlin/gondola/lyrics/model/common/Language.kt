@file:JvmName("LanguageHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.lowerTag
import gondola.lyrics.model.utils.scoreTag

/**
 * Picks the entry whose language matches `wanted` most closely: an exact match first, then the longest shared prefix, with ties going to the earlier entry.
 * Tags compare case-insensitively on subtag boundaries, and either side may be the more specific one, so `ja` picks `ja-JP` while `zh-Hans` never picks `zh-CN`.
 * With no match, or no `wanted`, it returns the first entry carrying no language, else the first entry only if `fallback` is set.
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
 * Picks the entry whose language matches `wanted` most closely: an exact match first, then the longest shared prefix, with ties going to the earlier entry.
 * Tags compare case-insensitively on subtag boundaries, and either side may be the more specific one, so `ja` picks `ja-JP` while `zh-Hans` never picks `zh-CN`.
 * With no match, or no `wanted`, it returns the first entry carrying no language, else the first entry only if `fallback` is set.
 */
@JvmName("pickTextByLanguage")
fun pickItemByLanguage(items: List<Text>, wanted: String? = null, fallback: Boolean = false): Text? {
    return pickItemByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Picks the entry whose language matches `wanted` most closely: an exact match first, then the longest shared prefix, with ties going to the earlier entry.
 * Tags compare case-insensitively on subtag boundaries, and either side may be the more specific one, so `ja` picks `ja-JP` while `zh-Hans` never picks `zh-CN`.
 * With no match, or no `wanted`, it returns the first entry carrying no language, else the first entry only if `fallback` is set.
 */
@JvmName("pickLineAnnotationRomanByLanguage")
fun pickItemByLanguage(items: List<LineAnnotationRoman>, wanted: String? = null, fallback: Boolean = false): LineAnnotationRoman? {
    return pickItemByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Picks the entry whose language matches `wanted` most closely: an exact match first, then the longest shared prefix, with ties going to the earlier entry.
 * Tags compare case-insensitively on subtag boundaries, and either side may be the more specific one, so `ja` picks `ja-JP` while `zh-Hans` never picks `zh-CN`.
 * With no match, or no `wanted`, it returns the first entry carrying no language, else the first entry only if `fallback` is set.
 */
@JvmName("pickLineAnnotationTranslationByLanguage")
fun pickItemByLanguage(items: List<LineAnnotationTranslation>, wanted: String? = null, fallback: Boolean = false): LineAnnotationTranslation? {
    return pickItemByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Picks the entry whose language matches `wanted` most closely: an exact match first, then the longest shared prefix, with ties going to the earlier entry.
 * Tags compare case-insensitively on subtag boundaries, and either side may be the more specific one, so `ja` picks `ja-JP` while `zh-Hans` never picks `zh-CN`.
 * With no match, or no `wanted`, it returns the first entry carrying no language, else the first entry only if `fallback` is set.
 */
@JvmName("pickWordAnnotationRomanByLanguage")
fun pickItemByLanguage(items: List<WordAnnotationRoman>, wanted: String? = null, fallback: Boolean = false): WordAnnotationRoman? {
    return pickItemByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Picks the entry whose language matches `wanted` most closely: an exact match first, then the longest shared prefix, with ties going to the earlier entry.
 * Tags compare case-insensitively on subtag boundaries, and either side may be the more specific one, so `ja` picks `ja-JP` while `zh-Hans` never picks `zh-CN`.
 * With no match, or no `wanted`, it returns the first entry carrying no language, else the first entry only if `fallback` is set.
 */
@JvmName("pickWordAnnotationRubyByLanguage")
fun pickItemByLanguage(items: List<WordAnnotationRuby>, wanted: String? = null, fallback: Boolean = false): WordAnnotationRuby? {
    return pickItemByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Picks the entry whose language matches `wanted` most closely: an exact match first, then the longest shared prefix, with ties going to the earlier entry.
 * Tags compare case-insensitively on subtag boundaries, and either side may be the more specific one, so `ja` picks `ja-JP` while `zh-Hans` never picks `zh-CN`.
 * With no match, or no `wanted`, it returns the first entry carrying no language, else the first entry only if `fallback` is set.
 */
@JvmName("pickWordAnnotationTranslationByLanguage")
fun pickItemByLanguage(items: List<WordAnnotationTranslation>, wanted: String? = null, fallback: Boolean = false): WordAnnotationTranslation? {
    return pickItemByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Picks the entry whose language matches `wanted` most closely: an exact match first, then the longest shared prefix, with ties going to the earlier entry.
 * Tags compare case-insensitively on subtag boundaries, and either side may be the more specific one, so `ja` picks `ja-JP` while `zh-Hans` never picks `zh-CN`.
 * With no match, or no `wanted`, it returns the first entry carrying no language, else the first entry only if `fallback` is set.
 */
@JvmName("pickStorageWordByLanguage")
fun pickItemByLanguage(
    items: List<gondola.lyrics.model.storage.Word>,
    wanted: String? = null,
    fallback: Boolean = false,
): gondola.lyrics.model.storage.Word? {
    return pickItemByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Picks the entry whose language matches `wanted` most closely: an exact match first, then the longest shared prefix, with ties going to the earlier entry.
 * Tags compare case-insensitively on subtag boundaries, and either side may be the more specific one, so `ja` picks `ja-JP` while `zh-Hans` never picks `zh-CN`.
 * With no match, or no `wanted`, it returns the first entry carrying no language, else the first entry only if `fallback` is set.
 */
@JvmName("pickRuntimeWordByLanguage")
fun pickItemByLanguage(
    items: List<gondola.lyrics.model.runtime.Word>,
    wanted: String? = null,
    fallback: Boolean = false,
): gondola.lyrics.model.runtime.Word? {
    return pickItemByLanguage(items, wanted, fallback) { it.language }
}
