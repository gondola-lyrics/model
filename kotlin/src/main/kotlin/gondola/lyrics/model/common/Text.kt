@file:JvmName("TextHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.lowerTag

/**
 * Creates a Text, text with an optional BCP 47 language tag.
 * The tag is kept as given, since canonical form is `canonicalizeText`'s to produce and a constructor that quietly rewrote one would make two spellings of the same field.
 */
fun makeText(language: String? = null, text: String = ""): Text {
    return Text(language = language, text = text)
}

/**
 * Validates a Text: its text must be non-empty, since a Text names something and an empty one names nothing.
 * A list holding one entry per language still holds a language with it, so the empty entry is reported here rather than dropped.
 */
fun validateText(text: Text, path: String = ""): List<Diagnostic> {
    return if (text.text.isEmpty()) listOf(Diagnostic(path, DiagnosticCode.TextTextEmpty)) else emptyList()
}

/**
 * Returns a copy of the Text with its language tag lowercased, treating an empty tag as unset.
 */
fun canonicalizeText(text: Text): Text {
    return text.copy(language = lowerTag(text.language))
}
