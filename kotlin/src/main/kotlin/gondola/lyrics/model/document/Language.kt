@file:JvmName("LanguageHelper")

package gondola.lyrics.model.document

import gondola.lyrics.model.common.pickItemByLanguage as pickByLanguage

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickDocumentLineAnnotationRomanByLanguage")
fun pickDocumentItemByLanguage(items: List<LineAnnotationRoman>, wanted: String? = null, fallback: Boolean = false): LineAnnotationRoman? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickDocumentLineAnnotationTranslationByLanguage")
fun pickDocumentItemByLanguage(
    items: List<LineAnnotationTranslation>,
    wanted: String? = null,
    fallback: Boolean = false,
): LineAnnotationTranslation? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickDocumentWordAnnotationRomanByLanguage")
fun pickDocumentItemByLanguage(items: List<WordAnnotationRoman>, wanted: String? = null, fallback: Boolean = false): WordAnnotationRoman? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickDocumentWordAnnotationRubyByLanguage")
fun pickDocumentItemByLanguage(items: List<WordAnnotationRuby>, wanted: String? = null, fallback: Boolean = false): WordAnnotationRuby? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickDocumentWordAnnotationTranslationByLanguage")
fun pickDocumentItemByLanguage(
    items: List<WordAnnotationTranslation>,
    wanted: String? = null,
    fallback: Boolean = false,
): WordAnnotationTranslation? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickDocumentWordByLanguage")
fun pickDocumentItemByLanguage(items: List<Word>, wanted: String? = null, fallback: Boolean = false): Word? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}
