@file:JvmName("LanguageHelper")

package gondola.lyrics.model.runtime

import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.LineType
import gondola.lyrics.model.common.WordType
import gondola.lyrics.model.common.isLanguageTag
import gondola.lyrics.model.utils.MAX_COUNT
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.compareTags
import gondola.lyrics.model.utils.lowerTag
import gondola.lyrics.model.utils.uint32

/**
 * Creates a LanguageUsage, counting the normal lines declaring one language.
 * The count must fit in uint32.
 */
public fun makeLanguageUsage(tag: String = "", count: Long = 0): LanguageUsage {
    return LanguageUsage(tag = tag, count = uint32(count))
}

/**
 * Validates a LanguageUsage: its tag must name a language, and its count must lie within the schema's domain.
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
 * Orders language usages into canonical order: descending count, then ascending tag read without case.
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
 * Counts language declarations across normal lines, collecting both line tags and normal-word tags even when the line already declares languages.
 * Each lowercased language counts once per line; empty or missing tags are skipped, and only explicitly declared `und` is counted.
 * Spaces, annotations and background lines contribute nothing, and the result is ordered by descending count then ascending tag.
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
 * Counts language declarations across normal lines, collecting both line tags and normal-word tags even when the line already declares languages.
 * Each lowercased language counts once per line; empty or missing tags are skipped, and only explicitly declared `und` is counted.
 * Spaces, annotations and background lines contribute nothing, and the result is ordered by descending count then ascending tag.
 */
@JvmName("deriveStorageLanguageUsages")
public fun deriveLanguageUsages(lines: List<gondola.lyrics.model.storage.Line>): List<LanguageUsage> {
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
 * Canonicalizes a list of usages: tags lowercased, entries sharing a tag merged by summing their counts, entries naming no language dropped, then ordered.
 * A total past the field's bound is capped at it, since summing two entries is how one arises; a negative total remains invalid for validate to report.
 */
public fun canonicalizeLanguageUsages(languages: List<LanguageUsage>): List<LanguageUsage> {
    val counts = linkedMapOf<String, Long>()
    for (usage in languages) {
        // An empty tag names no language, so its count counts nothing, and every other list drops an empty entry the same way.
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
