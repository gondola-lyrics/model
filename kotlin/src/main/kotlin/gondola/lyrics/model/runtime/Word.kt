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
 * Creates an emphasis decision without defaulting its value or origin; explicit false values are preserved.
 */
public fun makeWordEmphasis(value: Boolean? = null, derived: Boolean? = null): WordEmphasis {
    return WordEmphasis(value = value, derived = derived)
}

/**
 * Returns a copy of the word canonicalized, dropping empty emphasis while preserving explicit false values.
 */
public fun canonicalizeWord(word: Word): Word {
    return canonicalizeWordShared(word).copy(emphasis = dropDefault(word.emphasis))
}
