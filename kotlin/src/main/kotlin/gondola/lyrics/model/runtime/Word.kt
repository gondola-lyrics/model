@file:JvmName("WordHelper")

package gondola.lyrics.model.runtime

import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.WordAnnotation
import gondola.lyrics.model.common.WordType
import gondola.lyrics.model.common.canonicalizeWordShared
import gondola.lyrics.model.utils.dropDefault

/**
 * Creates a normal word, stamping WORD_TYPE_NORMAL so the discriminant can never be set from outside.
 */
public fun makeWordNormal(
    time: TimeRange? = null,
    text: String = "",
    language: String? = null,
    annotation: WordAnnotation? = null,
    emphasis: WordEmphasis? = null,
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
 * Creates a WordEmphasis, whether a word is emphasized and whether that was derived rather than stated.
 */
public fun makeWordEmphasis(value: Boolean = false, derived: Boolean = false): WordEmphasis =
    WordEmphasis.newBuilder().setValue(value).setDerived(derived).build()

/**
 * Returns a copy of the word canonicalized, with its emphasis dropped when all-default.
 */
public fun canonicalizeWord(word: Word): Word {
    val builder = canonicalizeWordShared(word).toBuilder()
    val emphasis = dropDefault(word.emphasis.takeIf { word.hasEmphasis() })
    builder.clearEmphasis()
    if (emphasis != null) {
        builder.emphasis = emphasis
    }
    return builder.build()
}
