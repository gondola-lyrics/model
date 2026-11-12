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
 * Creates a language usage measured in normal lines within the uint32 domain.
 */
public fun makeEnrichedLanguageUsage(tag: String = "", lineCount: Long = 0): LanguageUsage {
    return LanguageUsage(tag = tag, lineCount = uint32(lineCount))
}

/**
 * Checks that the language tag is well formed and the line count fits uint32.
 */
public fun validateEnrichedLanguageUsage(usage: LanguageUsage, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (usage.tag.isEmpty()) {
        diagnostics += Diagnostic(childPath(path, "tag"), DiagnosticCode.LanguageUsageTagEmpty)
    } else if (!isLanguageTag(usage.tag)) {
        diagnostics += Diagnostic(childPath(path, "tag"), DiagnosticCode.LanguageTagMalformed)
    }
    if (usage.lineCount < 0) {
        diagnostics += Diagnostic(childPath(path, "lineCount"), DiagnosticCode.LanguageUsageLineCountInvalid)
    } else if (usage.lineCount > MAX_COUNT) {
        diagnostics += Diagnostic(childPath(path, "lineCount"), DiagnosticCode.LanguageUsageLineCountOverflow)
    }
    return diagnostics
}

/**
 * Orders line counts descending, then tags case-insensitively ascending.
 */
public fun orderEnrichedLanguageUsages(languageUsages: List<LanguageUsage>): List<LanguageUsage> {
    return languageUsages.sortedWith { a, b ->
        val order = b.lineCount.compareTo(a.lineCount)
        if (order != 0) {
            order
        } else {
            compareTags(a.tag, b.tag)
        }
    }
}

/**
 * Counts each distinct declared tag once per normal line, including its normal words.
 *
 * Spaces, annotations, backgrounds, and absent tags are excluded; explicit und tags are counted.
 * Multilingual lines contribute to multiple tags, so total counts may exceed the number of normal lines.
 */
public fun deriveEnrichedLanguageUsages(lines: List<Line>): List<LanguageUsage> {
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
    return orderEnrichedLanguageUsages(counts.map { (tag, lineCount) -> makeEnrichedLanguageUsage(tag, lineCount) })
}

/**
 * Counts each distinct declared tag once per normal line, including its normal words.
 *
 * Spaces, annotations, backgrounds, and absent tags are excluded; explicit und tags are counted.
 * Multilingual lines contribute to multiple tags, so total counts may exceed the number of normal lines.
 */
@JvmName("deriveEnrichedLanguageUsagesFromDocument")
public fun deriveEnrichedLanguageUsages(lines: List<gondola.lyrics.model.document.Line>): List<LanguageUsage> {
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
    return orderEnrichedLanguageUsages(counts.map { (tag, lineCount) -> makeEnrichedLanguageUsage(tag, lineCount) })
}

/**
 * Lowercases tags, merges duplicate line counts, drops untagged entries, and orders the result.
 *
 * Totals above uint32 are capped; negative line counts remain available for validation.
 */
public fun canonicalizeEnrichedLanguageUsages(languageUsages: List<LanguageUsage>): List<LanguageUsage> {
    val counts = linkedMapOf<String, Long>()
    for (usage in languageUsages) {
        val tag = lowerTag(usage.tag) ?: continue
        val previous = counts[tag] ?: 0
        val lineCount = usage.lineCount
        // Compare before adding so a Long overflow cannot turn an invalid line count into a valid one.
        counts[tag] = when {
            lineCount > 0 && previous > MAX_COUNT - lineCount -> MAX_COUNT
            lineCount < 0 && previous < Long.MIN_VALUE - lineCount -> Long.MIN_VALUE
            else -> minOf(previous + lineCount, MAX_COUNT)
        }
    }
    return orderEnrichedLanguageUsages(counts.map { (tag, lineCount) -> LanguageUsage(tag = tag, lineCount = lineCount) })
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickEnrichedLineAnnotationRomanByLanguage")
fun pickEnrichedItemByLanguage(items: List<LineAnnotationRoman>, wanted: String? = null, fallback: Boolean = false): LineAnnotationRoman? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickEnrichedLineAnnotationTranslationByLanguage")
fun pickEnrichedItemByLanguage(
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
@JvmName("pickEnrichedWordAnnotationRomanByLanguage")
fun pickEnrichedItemByLanguage(items: List<WordAnnotationRoman>, wanted: String? = null, fallback: Boolean = false): WordAnnotationRoman? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickEnrichedWordAnnotationRubyByLanguage")
fun pickEnrichedItemByLanguage(items: List<WordAnnotationRuby>, wanted: String? = null, fallback: Boolean = false): WordAnnotationRuby? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}

/**
 * Selects the closest language match on subtag boundaries, ignoring case.
 *
 * Without a match, uses an untagged entry, then the first entry only when fallback is enabled.
 */
@JvmName("pickEnrichedWordAnnotationTranslationByLanguage")
fun pickEnrichedItemByLanguage(
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
@JvmName("pickEnrichedWordByLanguage")
fun pickEnrichedItemByLanguage(items: List<Word>, wanted: String? = null, fallback: Boolean = false): Word? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}
