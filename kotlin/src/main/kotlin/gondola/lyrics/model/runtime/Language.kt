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
import gondola.lyrics.model.utils.unsigned

/**
 * Creates a LanguageUsage, counting the normal lines declaring one language.
 */
public fun makeLanguageUsage(tag: String = "", count: Long = 0): LanguageUsage =
    LanguageUsage.newBuilder().setTag(tag).setCount(uint32(count)).build()

/**
 * Validates a LanguageUsage: its tag must name a language; generated messages already constrain its count to the schema's uint32 domain.
 */
public fun validateLanguageUsage(usage: LanguageUsage, path: String = ""): List<Diagnostic> = when {
    usage.tag.isEmpty() -> listOf(Diagnostic(childPath(path, "tag"), DiagnosticCode.LanguageUsageTagEmpty))
    !isLanguageTag(usage.tag) -> listOf(Diagnostic(childPath(path, "tag"), DiagnosticCode.LanguageTagMalformed))
    else -> emptyList()
}

/**
 * Orders language usages into canonical order: descending count, then ascending tag read without case.
 */
public fun orderLanguageUsages(languages: List<LanguageUsage>): List<LanguageUsage> = languages.sortedWith { a, b ->
    val count = unsigned(b.count).compareTo(unsigned(a.count))
    if (count != 0) {
        count
    } else {
        compareTags(a.tag, b.tag)
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
        val tags = line.languagesList.mapNotNull(::lowerTag).toMutableSet()
        for (word in line.content.wordsList) {
            if (word.type == WordType.WORD_TYPE_NORMAL) {
                lowerTag(word.language.takeIf { word.hasLanguage() })?.let(tags::add)
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
        val tags = line.languagesList.mapNotNull(::lowerTag).toMutableSet()
        for (word in line.content.wordsList) {
            if (word.type == WordType.WORD_TYPE_NORMAL) {
                lowerTag(word.language.takeIf { word.hasLanguage() })?.let(tags::add)
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
 * A count past the field's bound is capped at it, since summing two entries is how one arises.
 * Aggregation rebuilds entries from their tags and counts, so entry-level unknown fields are not carried over.
 */
public fun canonicalizeLanguageUsages(languages: List<LanguageUsage>): List<LanguageUsage> {
    val counts = linkedMapOf<String, Long>()
    for (usage in languages) {
        // An empty tag names no language, so its count counts nothing, and every other list drops an empty entry the same way.
        val tag = lowerTag(usage.tag) ?: continue
        counts[tag] = minOf((counts[tag] ?: 0) + unsigned(usage.count), MAX_COUNT)
    }
    return orderLanguageUsages(counts.map { (tag, count) -> makeLanguageUsage(tag, count) })
}
