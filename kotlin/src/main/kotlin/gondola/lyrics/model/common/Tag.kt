@file:JvmName("TagHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.FieldShape
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.visitFields

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
fun isLanguageTag(tag: String): Boolean {
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

/**
 * Collects the malformed language tags below a message, reading the tree from its schema: a `languages` list holds tags directly, while a field named `language` holds one tag.
 * Only a malformed tag is reported, since an unset or empty one is what the rule demanding a tag is for.
 * `sealed` names the fields another validator reads, so a tag is never reported twice.
 */
private fun collectTagDiagnostics(message: Any, sealed: List<String>, path: String): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    visitFields(message) { name, shape, value ->
        if (name in sealed) {
            return@visitFields
        }
        val child = childPath(path, name)
        if (shape == FieldShape.LIST_MESSAGE) {
            (value as List<*>).forEachIndexed { index, item ->
                diagnostics.addAll(collectTagDiagnostics(requireNotNull(item), sealed, "$child[$index]"))
            }
        } else if (shape == FieldShape.LIST_SCALAR && name == "languages") {
            (value as List<*>).forEachIndexed { index, item ->
                if (item is String && item.isNotEmpty() && !isLanguageTag(item)) {
                    diagnostics.add(Diagnostic("$child[$index]", DiagnosticCode.LanguageTagMalformed))
                }
            }
        } else if (shape == FieldShape.MESSAGE && value != null) {
            diagnostics.addAll(collectTagDiagnostics(value, sealed, child))
        } else if ((shape == FieldShape.SCALAR || shape == FieldShape.OPTIONAL) && name == "language") {
            if (value is String && value.isNotEmpty() && !isLanguageTag(value)) {
                diagnostics.add(Diagnostic(child, DiagnosticCode.LanguageTagMalformed))
            }
        }
    }
    return diagnostics
}

/**
 * Collects the malformed language tags of one line: its own list, its words and its annotations.
 * A line is validated on its own as well as under a lyric, so where it sits changes nothing and the path is the line's own.
 */
internal fun validateLineTags(line: Any, path: String = ""): List<Diagnostic> {
    return collectTagDiagnostics(line, emptyList(), path)
}

/**
 * Collects the malformed language tags a lyric carries outside its lines: the language its metadata declares and the tags on every text it holds.
 * The lines are left to `validateLine`, which alone knows which fields a line's kind forbids.
 */
internal fun validateLyricTags(lyric: Any): List<Diagnostic> {
    return collectTagDiagnostics(lyric, listOf("lines"), "")
}
