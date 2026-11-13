@file:JvmName("TextHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.lowerTag

/**
 * Creates a Text, text with an optional BCP 47 language tag.
 * The tag is kept as given, since canonical form is `canonicalizeText`'s to produce and a constructor that quietly rewrote one would make two spellings of the same field.
 */
fun makeText(language: String? = null, text: String = ""): Text {
    return Text(language = language, text = text)
}

/**
 * Checks non-empty text and the syntax of its optional language tag.
 *
 * Paths are relative to the text unless its location is supplied.
 */
fun validateText(text: Text, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (text.text.isEmpty()) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.TextTextEmpty))
    }
    diagnostics.addAll(validateLanguageTag(text.language, childPath(path, "language")))
    return diagnostics
}

/**
 * Returns a copy of the Text with its language tag lowercased, treating an empty tag as unset.
 */
fun canonicalizeText(text: Text): Text {
    return text.copy(language = lowerTag(text.language))
}

/**
 * Creates a source fragment without normalizing its text or extension attributes.
 */
fun makeTextToken(time: TimeRange? = null, text: String = "", extra: Map<String, String> = emptyMap()): TextToken {
    return TextToken(time = time, text = text, extra = extra)
}

/**
 * Checks explicit timing and extension keys; text constraints belong to the containing annotation.
 */
fun validateTextToken(token: TextToken, path: String = ""): List<Diagnostic> {
    val diagnostics = token.time?.let { validateTimeRange(it, childPath(path, "time")) }?.toMutableList() ?: mutableListOf()
    if (token.extra.containsKey("")) {
        diagnostics.add(Diagnostic(childPath(path, "extra"), DiagnosticCode.TextTokenExtraKeyEmpty))
    }
    return diagnostics
}

/**
 * Copies timing and extensions without changing text, keys, or values.
 */
fun canonicalizeTextToken(token: TextToken): TextToken {
    return token.copy(time = token.time?.copy(), extra = token.extra.toMap())
}
