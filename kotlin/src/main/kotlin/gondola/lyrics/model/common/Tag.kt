@file:JvmName("TagHelper")

package gondola.lyrics.model.common

private val INVALID_TAG_CHARACTER = Regex("[^A-Za-z0-9-]")
private val LANGUAGE_PATTERN = Regex("^[a-z]{2,8}$")
private val EXTLANG_PATTERN = Regex("^[a-z]{3}$")
private val SCRIPT_PATTERN = Regex("^[a-z]{4}$")
private val REGION_PATTERN = Regex("^(?:[a-z]{2}|[0-9]{3})$")
private val VARIANT_PATTERN = Regex("^(?:[a-z0-9]{5,8}|[0-9][a-z0-9]{3})$")

/**
 * RFC 5646 fixes this list; several entries cannot be parsed as ordinary tags.
 */
private val GRANDFATHERED_TAGS = setOf(
    "en-gb-oed",
    "i-ami",
    "i-bnn",
    "i-default",
    "i-enochian",
    "i-hak",
    "i-klingon",
    "i-lux",
    "i-mingo",
    "i-navajo",
    "i-pwn",
    "i-tao",
    "i-tay",
    "i-tsu",
    "sgn-be-fr",
    "sgn-be-nl",
    "sgn-ch-de",
    "art-lojban",
    "cel-gaulish",
    "no-bok",
    "no-nyn",
    "zh-guoyu",
    "zh-hakka",
    "zh-min",
    "zh-min-nan",
    "zh-xiang",
)

/**
 * Checks BCP 47 syntax as defined by RFC 5646, including private use and grandfathered tags.
 *
 * Registry validity, uniqueness of variants and extension singletons, and extension semantics are not checked.
 */
fun isWellFormedLanguageTag(tag: String): Boolean {
    // Check before case conversion, which can map non-ASCII characters into ASCII.
    if (tag.isEmpty() || INVALID_TAG_CHARACTER.containsMatchIn(tag)) {
        return false
    }
    val lower = tag.lowercase()
    if (lower in GRANDFATHERED_TAGS) {
        return true
    }
    val subtags = lower.split('-')
    if (subtags.any { it.length !in 1..8 }) {
        return false
    }
    val language = subtags.first()
    if (language == "x") {
        return subtags.size > 1
    }
    if (!LANGUAGE_PATTERN.matches(language)) {
        return false
    }

    var index = 1
    if (language.length <= 3) {
        var extlangs = 0
        while (extlangs < 3 && EXTLANG_PATTERN.matches(subtags.getOrNull(index).orEmpty())) {
            index++
            extlangs++
        }
    }
    if (SCRIPT_PATTERN.matches(subtags.getOrNull(index).orEmpty())) {
        index++
    }
    if (REGION_PATTERN.matches(subtags.getOrNull(index).orEmpty())) {
        index++
    }
    while (VARIANT_PATTERN.matches(subtags.getOrNull(index).orEmpty())) {
        index++
    }
    while (subtags.getOrNull(index)?.length == 1 && subtags[index] != "x") {
        index++
        val contentStart = index
        while (index < subtags.size && subtags[index].length >= 2) {
            index++
        }
        if (index == contentStart) {
            return false
        }
    }
    if (subtags.getOrNull(index) == "x") {
        return index + 1 < subtags.size
    }
    return index == subtags.size
}

internal fun validateLanguageTag(tag: String?, path: String = ""): List<Diagnostic> {
    return if (!tag.isNullOrEmpty() && !isWellFormedLanguageTag(tag)) listOf(Diagnostic(path, DiagnosticCode.LanguageTagMalformed)) else emptyList()
}

internal fun validateLanguageTags(tags: List<String>, path: String = ""): List<Diagnostic> {
    return tags.flatMapIndexed { index, tag ->
        val tagPath = "$path[$index]"
        if (tag.isEmpty()) listOf(Diagnostic(tagPath, DiagnosticCode.LyricListEntryEmpty)) else validateLanguageTag(tag, tagPath)
    }
}
