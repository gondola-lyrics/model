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
    return Word(
        type = WordType.WORD_TYPE_NORMAL,
        time = time,
        text = text,
        language = language,
        annotation = annotation,
        emphasis = emphasis,
    )
}

/**
 * Creates a whitespace word carrying the separator as its text, stamping WORD_TYPE_SPACE.
 */
public fun makeWordSpace(text: String = ""): Word {
    return Word(type = WordType.WORD_TYPE_SPACE, text = text)
}

/**
 * Returns a copy of the word canonicalized; it carries no fields beyond the shared ones.
 */
public fun canonicalizeWord(word: Word): Word {
    return canonicalizeWordShared(word)
}
