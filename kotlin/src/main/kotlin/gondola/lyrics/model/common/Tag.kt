@file:JvmName("TagHelper")

package gondola.lyrics.model.common

import com.google.protobuf.Descriptors
import com.google.protobuf.Message
import gondola.lyrics.model.utils.childPath

/**
 * A tag is written as subtags of letters and digits, one to eight each, the first naming the language and so letters alone.
 * A private-use tag may be one subtag, so the bound is on the parts rather than their count.
 */
private val SUBTAG_PATTERN = Regex("^[a-z0-9]{1,8}$")
private val LANGUAGE_PATTERN = Regex("^[a-z]{2,8}$")

/**
 * The longest tag in the registry is 35 characters, so anything past that is not one.
 */
private const val MAX_TAG_LENGTH = 35

/**
 * Reports whether a tag is a well-formed BCP 47 language tag.
 * Only the shape is read, so `qqq` passes: whether a subtag is registered belongs to the registry rather than to this schema.
 * Tags are compared case-insensitively by the schema, and stored in lower case by its own rule, so a tag is read in lower case here.
 */
fun isLanguageTag(tag: String): Boolean {
    val lower = tag.lowercase()
    if (lower.length > MAX_TAG_LENGTH) {
        return false
    }
    val subtags = lower.split('-')
    return LANGUAGE_PATTERN.matches(subtags.first()) && subtags.all { SUBTAG_PATTERN.matches(it) }
}

/**
 * Collects the malformed language tags below a message, reading the tree from its schema: a `languages` list holds tags directly, while a field named `language` holds one tag.
 * Only a malformed tag is reported, since an unset or empty one is what the rule demanding a tag is for.
 * `exempt` names the fields that may hold a scheme instead, and `sealed` the fields another validator reads, so a tag is never reported twice.
 */
private fun collectTagDiagnostics(message: Message, exempt: List<String>, sealed: List<String>, path: String): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    for (field in message.descriptorForType.fields) {
        if (field.jsonName in sealed || field.isMapField) {
            continue
        }
        val child = childPath(path, field.jsonName)
        if (field.isRepeated) {
            val values = message.getField(field) as List<*>
            values.forEachIndexed { index, value ->
                if (value is Message) {
                    diagnostics.addAll(collectTagDiagnostics(value, exempt, sealed, "$child[$index]"))
                } else if (field.jsonName == "languages" && value is String && value.isNotEmpty() && !isLanguageTag(value)) {
                    diagnostics.add(Diagnostic("$child[$index]", DiagnosticCode.LanguageTagMalformed))
                }
            }
        } else if (field.javaType == Descriptors.FieldDescriptor.JavaType.MESSAGE && message.hasField(field)) {
            diagnostics.addAll(collectTagDiagnostics(message.getField(field) as Message, exempt, sealed, child))
        } else if (field.name == "language" && exempt.none { child.endsWith(it) }) {
            val value = message.getField(field) as String
            if (value.isNotEmpty() && !isLanguageTag(value)) {
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
fun validateLineTags(line: Message, path: String = ""): List<Diagnostic> {
    // The fields holding a transliteration scheme rather than a tag, which no tag is written like; `romaji` and `Hepburn` name how a text is romanized.
    return collectTagDiagnostics(line, listOf("annotation.romans.language"), emptyList(), path)
}

/**
 * Collects the malformed language tags a lyric carries outside its lines: the language its metadata declares and the tags on every text it holds.
 * The lines are left to `validateLine`, which alone knows which fields a line's kind forbids.
 */
fun validateLyricTags(lyric: Message): List<Diagnostic> = collectTagDiagnostics(lyric, emptyList(), listOf("lines"), "")
