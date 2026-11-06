@file:JvmName("WordHelper")

package gondola.lyrics.model.storage

import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.WordAnnotation
import gondola.lyrics.model.common.WordType
import gondola.lyrics.model.common.canonicalizeWordShared

/**
 * Creates a normal word, stamping WORD_TYPE_NORMAL so the discriminant can never be set from outside.
 */
public fun makeWordNormal(
    time: TimeRange? = null,
    text: String = "",
    language: String? = null,
    annotation: WordAnnotation? = null,
    emphasis: Boolean? = null,
): Word {
    val builder = Word.newBuilder().setType(WordType.WORD_TYPE_NORMAL).setText(text)
    if (time != null) {
        builder.time = time
    }
    if (language != null) {
        builder.language = language
    }
    if (annotation != null) {
        builder.annotation = annotation
    }
    if (emphasis != null) {
        builder.emphasis = emphasis
    }
    return builder.build()
}

/**
 * Creates a whitespace word carrying the separator as its text, stamping WORD_TYPE_SPACE.
 */
public fun makeWordSpace(text: String = ""): Word = Word.newBuilder().setType(WordType.WORD_TYPE_SPACE).setText(text).build()

/**
 * Returns a copy of the word canonicalized; it carries no fields beyond the shared ones.
 */
public fun canonicalizeWord(word: Word): Word = canonicalizeWordShared(word)
