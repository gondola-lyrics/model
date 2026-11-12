@file:JvmName("LanguageHelper")

package gondola.lyrics.model.enriched

import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.isLanguageTag
import gondola.lyrics.model.utils.MAX_COUNT
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.compareTags
import gondola.lyrics.model.utils.lowerTag
import gondola.lyrics.model.utils.uint32
import gondola.lyrics.model.common.pickItemByLanguage as pickByLanguage

/**
 * Creates a language count within the uint32 domain.
 */
public fun makeLanguageUsage(tag: String = "", count: Long = 0): LanguageUsage {
    return LanguageUsage(tag = tag, count = uint32(count))
}

/**
 * Checks that the language tag is well formed and the count fits uint32.
 */
public fun validateLanguageUsage(usage: LanguageUsage, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (usage.tag.isEmpty()) {
        diagnostics += Diagnostic(childPath(path, "tag"), DiagnosticCode.LanguageUsageTagEmpty)
    } else if (!isLanguageTag(usage.tag)) {
        diagnostics += Diagnostic(childPath(path, "tag"), DiagnosticCode.LanguageTagMalformed)
    }
    if (usage.count < 0) {
        diagnostics += Diagnostic(childPath(path, "count"), DiagnosticCode.LanguageUsageCountInvalid)
    } else if (usage.count > MAX_COUNT) {
        diagnostics += Diagnostic(childPath(path, "count"), DiagnosticCode.LanguageUsageCountOverflow)
    }
    return diagnostics
}

/**
 * Orders language counts descending, then tags case-insensitively ascending.
 */
public fun orderLanguageUsages(languages: List<LanguageUsage>): List<LanguageUsage> {
    return languages.sortedWith { a, b ->
        val count = b.count.compareTo(a.count)
        if (count != 0) {
            count
        } else {
            compareTags(a.tag, b.tag)
        }
    }
}

/**
 * Counts each distinct declared tag once per normal line, including its normal words.
 *
 * Spaces, annotations, backgrounds, and absent tags are excluded; explicit und tags are counted.
 */
public fun deriveLanguageUsages(lines: List<Line>): List<LanguageUsage> {
    val counts = linkedMapOf<String, Long>()
    for (line in lines) {
        if (line.type != LineType.LINE_TYPE_NORMAL) {
            continue
        }
        val tags = line.languages.mapNotNull(::lowerTag).toMutableSet()
        for (word in line.content?.words.orEmpty()) {
            if (word.type == WordType.WORD_TYPE_NORMAL) {
                lowerTag(word.language)?.let(tags::add)
            }
        }
        for (tag in tags) {
            counts[tag] = (counts[tag] ?: 0) + 1
        }
    }
    return orderLanguageUsages(counts.map { (tag, count) -> makeLanguageUsage(tag, count) })
}

/**
 * Counts each distinct declared tag once per normal line, including its normal words.
 *
 * Spaces, annotations, backgrounds, and absent tags are excluded; explicit und tags are counted.
 */
@JvmName("deriveDocumentLanguageUsages")
public fun deriveLanguageUsages(lines: List<gondola.lyrics.model.document.Line>): List<LanguageUsage> {
    val counts = linkedMapOf<String, Long>()
    for (line in lines) {
        if (line.type != gondola.lyrics.model.document.LineType.LINE_TYPE_NORMAL) {
            continue
        }
        val tags = line.languages.mapNotNull(::lowerTag).toMutableSet()
        for (word in line.content?.words.orEmpty()) {
            if (word.type == gondola.lyrics.model.document.WordType.WORD_TYPE_NORMAL) {
                lowerTag(word.language)?.let(tags::add)
            }
        }
        for (tag in tags) {
            counts[tag] = (counts[tag] ?: 0) + 1
        }
    }
    return orderLanguageUsages(counts.map { (tag, count) -> makeLanguageUsage(tag, count) })
}

/**
 * Lowercases tags, merges duplicate counts, drops untagged entries, and orders the result.
 *
 * Totals above uint32 are capped; negative counts remain available for validation.
 */
public fun canonicalizeLanguageUsages(languages: List<LanguageUsage>): List<LanguageUsage> {
    val counts = linkedMapOf<String, Long>()
    for (usage in languages) {
        val tag = lowerTag(usage.tag) ?: continue
        val previous = counts[tag] ?: 0
        val count = usage.count
        // Compare before adding so a Long overflow cannot turn an invalid count into a valid one.
        counts[tag] = when {
            count > 0 && previous > MAX_COUNT - count -> MAX_COUNT
            count < 0 && previous < Long.MIN_VALUE - count -> Long.MIN_VALUE
            else -> minOf(previous + count, MAX_COUNT)
        }
    }
    return orderLanguageUsages(counts.map { (tag, count) -> LanguageUsage(tag = tag, count = count) })
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickLineAnnotationRomanByLanguage")
fun pickItemByLanguage(items: List<LineAnnotationRoman>, wanted: String? = null, fallback: Boolean = false): LineAnnotationRoman? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickLineAnnotationTranslationByLanguage")
fun pickItemByLanguage(items: List<LineAnnotationTranslation>, wanted: String? = null, fallback: Boolean = false): LineAnnotationTranslation? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickWordAnnotationRomanByLanguage")
fun pickItemByLanguage(items: List<WordAnnotationRoman>, wanted: String? = null, fallback: Boolean = false): WordAnnotationRoman? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickWordAnnotationRubyByLanguage")
fun pickItemByLanguage(items: List<WordAnnotationRuby>, wanted: String? = null, fallback: Boolean = false): WordAnnotationRuby? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickWordAnnotationTranslationByLanguage")
fun pickItemByLanguage(items: List<WordAnnotationTranslation>, wanted: String? = null, fallback: Boolean = false): WordAnnotationTranslation? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickWordByLanguage")
fun pickItemByLanguage(items: List<Word>, wanted: String? = null, fallback: Boolean = false): Word? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}
