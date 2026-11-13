@file:JvmName("LanguageHelper")

package gondola.lyrics.model.enriched

import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.isWellFormedLanguageTag
import gondola.lyrics.model.utils.MAX_COUNT
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.compareTags
import gondola.lyrics.model.utils.lowerNonEmptyTag
import gondola.lyrics.model.utils.requireUInt32
import gondola.lyrics.model.common.pickItemByLanguage as pickByLanguage

/**
 * Creates a language usage measured in normal lines within the uint32 domain.
 */
public fun makeEnrichedLanguageUsage(tag: String = "", lineCount: Long = 0): LanguageUsage {
    return LanguageUsage(tag = tag, lineCount = requireUInt32(lineCount))
}

/**
 * Checks that the language tag is well formed and the line count fits uint32.
 */
public fun validateEnrichedLanguageUsage(usage: LanguageUsage, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (usage.tag.isEmpty()) {
        diagnostics += Diagnostic(childPath(path, "tag"), DiagnosticCode.LanguageUsageTagEmpty)
    } else if (!isWellFormedLanguageTag(usage.tag)) {
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
 * Orders non-negative counts descending, then tags case-insensitively ascending.
 *
 * Negative counts follow in source order.
 */
public fun orderEnrichedLanguageUsages(languageUsages: List<LanguageUsage>): List<LanguageUsage> {
    return languageUsages.sortedWith { a, b ->
        if (a.lineCount < 0) {
            return@sortedWith if (b.lineCount < 0) 0 else 1
        }
        if (b.lineCount < 0) {
            return@sortedWith -1
        }
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
        val tags = line.languages.mapNotNull(::lowerNonEmptyTag).toMutableSet()
        for (word in line.content?.words.orEmpty()) {
            if (word.type == WordType.WORD_TYPE_NORMAL) {
                lowerNonEmptyTag(word.language)?.let(tags::add)
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
        val tags = line.languages.mapNotNull(::lowerNonEmptyTag).toMutableSet()
        for (word in line.content?.words.orEmpty()) {
            if (word.type == gondola.lyrics.model.document.WordType.WORD_TYPE_NORMAL) {
                lowerNonEmptyTag(word.language)?.let(tags::add)
            }
        }
        for (tag in tags) {
            counts[tag] = (counts[tag] ?: 0) + 1
        }
    }
    return orderEnrichedLanguageUsages(counts.map { (tag, lineCount) -> makeEnrichedLanguageUsage(tag, lineCount) })
}

/**
 * Lowercases tags, merges non-negative counts, drops untagged entries, and orders the result.
 *
 * Overflow is capped at uint32; negative counts remain separate at the end in source order.
 */
public fun canonicalizeEnrichedLanguageUsages(languageUsages: List<LanguageUsage>): List<LanguageUsage> {
    val counts = linkedMapOf<String, Long>()
    val invalid = mutableListOf<LanguageUsage>()
    for (usage in languageUsages) {
        val tag = lowerNonEmptyTag(usage.tag) ?: continue
        if (usage.lineCount < 0) {
            invalid += usage.copy(tag = tag)
            continue
        }
        // Cap each operand so the sum fits Long even when the input is Long.MAX_VALUE.
        val lineCount = minOf(usage.lineCount, MAX_COUNT)
        counts[tag] = minOf((counts[tag] ?: 0) + lineCount, MAX_COUNT)
    }
    val merged = counts.map { (tag, lineCount) -> LanguageUsage(tag = tag, lineCount = lineCount) }
    return orderEnrichedLanguageUsages(merged + invalid)
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
 * Tries language preferences in order; ties within a preference keep source order.
 *
 * Uses an untagged entry after every preference fails, then the first entry only when fallback is enabled.
 */
@JvmName("pickEnrichedLineAnnotationRomanByLanguagePreferences")
fun pickEnrichedItemByLanguage(items: List<LineAnnotationRoman>, wanted: List<String>, fallback: Boolean = false): LineAnnotationRoman? {
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
 * Tries language preferences in order; ties within a preference keep source order.
 *
 * Uses an untagged entry after every preference fails, then the first entry only when fallback is enabled.
 */
@JvmName("pickEnrichedLineAnnotationTranslationByLanguagePreferences")
fun pickEnrichedItemByLanguage(items: List<LineAnnotationTranslation>, wanted: List<String>, fallback: Boolean = false): LineAnnotationTranslation? {
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
 * Tries language preferences in order; ties within a preference keep source order.
 *
 * Uses an untagged entry after every preference fails, then the first entry only when fallback is enabled.
 */
@JvmName("pickEnrichedWordAnnotationRomanByLanguagePreferences")
fun pickEnrichedItemByLanguage(items: List<WordAnnotationRoman>, wanted: List<String>, fallback: Boolean = false): WordAnnotationRoman? {
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
 * Tries language preferences in order; ties within a preference keep source order.
 *
 * Uses an untagged entry after every preference fails, then the first entry only when fallback is enabled.
 */
@JvmName("pickEnrichedWordAnnotationRubyByLanguagePreferences")
fun pickEnrichedItemByLanguage(items: List<WordAnnotationRuby>, wanted: List<String>, fallback: Boolean = false): WordAnnotationRuby? {
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
 * Tries language preferences in order; ties within a preference keep source order.
 *
 * Uses an untagged entry after every preference fails, then the first entry only when fallback is enabled.
 */
@JvmName("pickEnrichedWordAnnotationTranslationByLanguagePreferences")
fun pickEnrichedItemByLanguage(items: List<WordAnnotationTranslation>, wanted: List<String>, fallback: Boolean = false): WordAnnotationTranslation? {
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

/**
 * Tries language preferences in order; ties within a preference keep source order.
 *
 * Uses an untagged entry after every preference fails, then the first entry only when fallback is enabled.
 */
@JvmName("pickEnrichedWordByLanguagePreferences")
fun pickEnrichedItemByLanguage(items: List<Word>, wanted: List<String>, fallback: Boolean = false): Word? {
    return pickByLanguage(items, wanted, fallback) { it.language }
}
