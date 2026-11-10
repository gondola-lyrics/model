@file:JvmName("WordHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.canonicalizeField
import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.findDuplicates
import gondola.lyrics.model.utils.isTimeRangeUncovered
import gondola.lyrics.model.utils.isUnresolved
import gondola.lyrics.model.utils.lowerTag
import gondola.lyrics.model.runtime.Word as RuntimeWord
import gondola.lyrics.model.storage.Word as StorageWord

/**
 * The fields every layer's word shares, so helpers that only read them work on either layer.
 */
internal data class WordView(
    val type: WordType,
    val time: TimeRange?,
    val text: String,
    val language: String?,
    val annotation: WordAnnotation?,
    val hasEmphasis: Boolean,
)

internal fun StorageWord.asWordView(): WordView {
    return WordView(
        type,
        time,
        text,
        language,
        annotation,
        emphasis != null,
    )
}

internal fun RuntimeWord.asWordView(): WordView {
    return WordView(
        type,
        time,
        text,
        language,
        annotation,
        emphasis != null,
    )
}

/**
 * A separator between two words, which the schema defines as the Unicode White_Space property.
 * The set is listed explicitly because Java's whitespace classes do not all use this property.
 * `U+200B` is a format character rather than a space, so it stays part of a sung word.
 */
private val separator = Regex("[\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]")
private val onlySeparators = Regex("${separator.pattern}+")

/**
 * Reports whether a declared precision puts timing on the words themselves, which is what makes a word's own range mean anything.
 * Under NONE and LINE the lyric reports the word list as a whole, so no range inside it is held to another.
 */
private fun ownsWordTimes(timing: Timing): Boolean {
    return timing != Timing.TIMING_NONE && timing != Timing.TIMING_LINE
}

/**
 * Creates a WordAnnotationToken, one timed piece of a ruby or roman annotation.
 */
public fun makeWordAnnotationToken(time: TimeRange? = null, text: String = ""): WordAnnotationToken {
    return WordAnnotationToken(time = time, text = text)
}

/**
 * Creates a WordAnnotationRoman, a romanized transliteration of a single word.
 */
public fun makeWordAnnotationRoman(
    time: TimeRange? = null,
    language: String? = null,
    tokens: List<WordAnnotationToken> = emptyList(),
): WordAnnotationRoman {
    return WordAnnotationRoman(time = time, language = language, tokens = tokens)
}

/**
 * Creates a WordAnnotationTranslation, a translation of a single word.
 */
public fun makeWordAnnotationTranslation(language: String? = null, text: String = ""): WordAnnotationTranslation {
    return WordAnnotationTranslation(language = language, text = text)
}

/**
 * Creates a WordAnnotationRuby, a ruby annotation of a single word such as furigana.
 */
public fun makeWordAnnotationRuby(
    time: TimeRange? = null,
    language: String? = null,
    tokens: List<WordAnnotationToken> = emptyList(),
): WordAnnotationRuby {
    return WordAnnotationRuby(time = time, language = language, tokens = tokens)
}

/**
 * Creates a WordAnnotation, the per-word annotation container.
 */
public fun makeWordAnnotation(
    rubies: List<WordAnnotationRuby> = emptyList(),
    romans: List<WordAnnotationRoman> = emptyList(),
    translations: List<WordAnnotationTranslation> = emptyList(),
): WordAnnotation {
    return WordAnnotation(rubies = rubies, romans = romans, translations = translations)
}

/**
 * Validates a WordAnnotation: each of its lists holds one entry per language, and every ruby and roman item, and every token within them, must carry a valid time when it carries one at all.
 * An item or token without a time inherits one, so its absence is never a problem here.
 * `time` is the range the items inherit, i.e. the annotated word's where the lyric's precision puts one on it at all; an item carrying its own falls within it, while a token falls within whichever range its item resolves to and so is held to one either way.
 */
public fun validateWordAnnotation(annotation: WordAnnotation, path: String = "", time: TimeRange? = null): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()

    /**
     * Reports every entry of one list whose language an earlier entry already took, treating an unset and an empty tag as the same default language.
     */
    fun <T> checkLanguages(items: List<T>, field: String, code: DiagnosticCode, language: (T) -> String?) {
        findDuplicates(items) { lowerTag(language(it)) ?: "" }.forEach { index ->
            diagnostics.add(Diagnostic(childPath(path, "$field[$index]"), code))
        }
    }

    /**
     * Validates the time of one timed annotation item, and of every token it holds, against both its own domain and the range containing it.
     */
    fun validateItem(itemTime: TimeRange?, tokens: List<WordAnnotationToken>, itemPath: String) {
        if (itemTime != null) {
            diagnostics.addAll(validateTimeRange(itemTime, childPath(itemPath, "time")))
        }
        // An item is the annotated word's own stretch of sound respelled rather than a second voice, so it falls within the range it would otherwise inherit instead of beside it.
        if (isTimeRangeUncovered(itemTime, time)) {
            diagnostics.add(Diagnostic(childPath(itemPath, "time"), DiagnosticCode.LineWordAnnotationTimeUncovered))
        }
        // A token follows its item's range, or the word's where the item states none, which is the one `resolveAnnotationTokenTime` hands back and so the one containing it.
        val inherited = itemTime ?: time
        tokens.forEachIndexed { index, token ->
            val tokenPath = childPath(itemPath, "tokens[$index].time")
            val tokenTime = token.time
            if (tokenTime != null) {
                diagnostics.addAll(validateTimeRange(tokenTime, tokenPath))
            }
            if (isTimeRangeUncovered(tokenTime, inherited)) {
                diagnostics.add(Diagnostic(tokenPath, DiagnosticCode.LineWordAnnotationTimeUncovered))
            }
        }
    }
    checkLanguages(annotation.rubies, "rubies", DiagnosticCode.LineWordAnnotationRubiesLanguageDuplicate) { it.language }
    checkLanguages(annotation.romans, "romans", DiagnosticCode.LineWordAnnotationRomansLanguageDuplicate) { it.language }
    checkLanguages(annotation.translations, "translations", DiagnosticCode.LineWordAnnotationTranslationsLanguageDuplicate) { it.language }
    annotation.rubies.forEachIndexed { index, item ->
        validateItem(item.time, item.tokens, childPath(path, "rubies[$index]"))
    }
    annotation.romans.forEachIndexed { index, item ->
        validateItem(item.time, item.tokens, childPath(path, "romans[$index]"))
    }
    return diagnostics
}

private fun validateWordView(word: WordView, path: String, timing: Timing): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    // A kind outside the enum reads as unresolved too, since a value this schema does not know cannot be held to any of its kind's rules.
    if (isUnresolved(word.type)) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.WordTypeUnspecified))
    }
    if (word.type == WordType.WORD_TYPE_NORMAL && word.text.isEmpty()) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.WordTextEmpty))
    } else if (word.type == WordType.WORD_TYPE_NORMAL && separator.containsMatchIn(word.text)) {
        // The separators around a word belong to the SPACE words beside it, so a sung word holding one has swallowed a boundary that words are split on.
        diagnostics.add(Diagnostic(childPath(path, "text"), DiagnosticCode.WordTextSeparator))
    }
    if (word.type == WordType.WORD_TYPE_SPACE) {
        // A SPACE word is the separator, so its text is what the rule is about; an empty one separates nothing and is reported the same way.
        if (!onlySeparators.matches(word.text)) {
            diagnostics.add(Diagnostic(childPath(path, "text"), DiagnosticCode.WordTextNotSeparator))
        }
        // A SPACE word carries the separator and nothing else; a field holding an all-default value still counts as carried, and a forbidden one is never descended into.
        if (word.time != null) {
            diagnostics.add(Diagnostic(childPath(path, "time"), DiagnosticCode.LineWordTimeUnexpected))
        }
        if (word.language != null) {
            diagnostics.add(Diagnostic(childPath(path, "language"), DiagnosticCode.LineWordLanguageUnexpected))
        }
        if (word.annotation != null) {
            diagnostics.add(Diagnostic(childPath(path, "annotation"), DiagnosticCode.LineWordAnnotationUnexpected))
        }
        // Each layer shapes emphasis differently, so it is read through presence alone rather than through either layer's schema.
        if (word.hasEmphasis) {
            diagnostics.add(Diagnostic(childPath(path, "emphasis"), DiagnosticCode.LineWordEmphasisUnexpected))
        }
        return diagnostics
    }
    if (word.time != null) {
        diagnostics.addAll(validateTimeRange(word.time, childPath(path, "time")))
    }
    if (word.annotation != null) {
        // The range an item inherits is the word's own, so it is passed down only where the precision puts timing on the words at all.
        diagnostics.addAll(validateWordAnnotation(word.annotation, childPath(path, "annotation"), word.time.takeIf { ownsWordTimes(timing) }))
    }
    return diagnostics
}

/**
 * Validates a Word: its kind must be resolved, a NORMAL word must carry non-empty text holding no separator, a SPACE word must carry a separator and nothing else, and any time and annotation it does carry must be valid.
 * `timing` is the lyric's declared precision, which says whether the word owns the range its annotation items inherit.
 */
public fun validateWord(word: StorageWord, path: String = "", timing: Timing = Timing.TIMING_UNSPECIFIED): List<Diagnostic> {
    return validateWordView(word.asWordView(), path, timing)
}

/**
 * Validates a Word: its kind must be resolved, a NORMAL word must carry non-empty text holding no separator, a SPACE word must carry a separator and nothing else, and any time and annotation it does carry must be valid.
 * `timing` is the lyric's declared precision, which says whether the word owns the range its annotation items inherit.
 */
public fun validateWord(word: RuntimeWord, path: String = "", timing: Timing = Timing.TIMING_UNSPECIFIED): List<Diagnostic> {
    return validateWordView(word.asWordView(), path, timing)
}

private fun validateWordViews(words: List<WordView>, time: TimeRange?, path: String, timing: Timing): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val ownTimes = ownsWordTimes(timing)
    words.forEachIndexed { index, word ->
        val wordPath = childPath(path, "words[$index]")
        diagnostics.addAll(validateWordView(word, wordPath, timing))
        if (ownTimes && word.type == WordType.WORD_TYPE_NORMAL && word.time == null) {
            diagnostics.add(Diagnostic(wordPath, DiagnosticCode.LineWordTimeMissing))
        }
        // A SPACE word was already told to carry no time at all, so its range stays out of the comparison.
        if (ownTimes && word.type != WordType.WORD_TYPE_SPACE && isTimeRangeUncovered(word.time, time)) {
            diagnostics.add(Diagnostic(childPath(wordPath, "time"), DiagnosticCode.LineWordTimeUncovered))
        }
    }
    return diagnostics
}

/**
 * Validates the words of a line or background line: each word must be valid, each sung word must carry a time, and each timed word must fall within `time` when it is set.
 * Those two time rules hold only where `timing` puts timing on the words; under NONE and LINE the lyric reports the words themselves instead.
 */
@JvmName("validateStorageWords")
public fun validateWords(
    words: List<StorageWord>,
    time: TimeRange?,
    path: String = "",
    timing: Timing = Timing.TIMING_UNSPECIFIED,
): List<Diagnostic> {
    return validateWordViews(words.map { it.asWordView() }, time, path, timing)
}

/**
 * Validates the words of a line or background line: each word must be valid, each sung word must carry a time, and each timed word must fall within `time` when it is set.
 * Those two time rules hold only where `timing` puts timing on the words; under NONE and LINE the lyric reports the words themselves instead.
 */
@JvmName("validateRuntimeWords")
public fun validateWords(
    words: List<RuntimeWord>,
    time: TimeRange?,
    path: String = "",
    timing: Timing = Timing.TIMING_UNSPECIFIED,
): List<Diagnostic> {
    return validateWordViews(words.map { it.asWordView() }, time, path, timing)
}

/**
 * Returns the annotation token unchanged, since its time and text are immutable and have nothing to normalize.
 */
public fun canonicalizeWordAnnotationToken(token: WordAnnotationToken): WordAnnotationToken {
    return token
}

/**
 * Returns a copy of the roman annotation with its language lowercased and its tokens canonicalized.
 */
public fun canonicalizeWordAnnotationRoman(roman: WordAnnotationRoman): WordAnnotationRoman {
    return roman.copy(
        language = lowerTag(roman.language),
        tokens = canonicalizeList(roman.tokens, ::canonicalizeWordAnnotationToken),
    )
}

/**
 * Returns a copy of the ruby annotation with its language lowercased and its tokens canonicalized.
 */
public fun canonicalizeWordAnnotationRuby(ruby: WordAnnotationRuby): WordAnnotationRuby {
    return ruby.copy(
        language = lowerTag(ruby.language),
        tokens = canonicalizeList(ruby.tokens, ::canonicalizeWordAnnotationToken),
    )
}

/**
 * Returns a copy of the translation annotation with its language lowercased.
 */
public fun canonicalizeWordAnnotationTranslation(translation: WordAnnotationTranslation): WordAnnotationTranslation {
    return translation.copy(language = lowerTag(translation.language))
}

/**
 * Returns a copy of the annotation with each of its lists canonicalized and all-default entries dropped.
 */
public fun canonicalizeWordAnnotation(annotation: WordAnnotation): WordAnnotation {
    return annotation.copy(
        rubies = canonicalizeList(annotation.rubies, ::canonicalizeWordAnnotationRuby),
        romans = canonicalizeList(annotation.romans, ::canonicalizeWordAnnotationRoman),
        translations = canonicalizeList(annotation.translations, ::canonicalizeWordAnnotationTranslation),
    )
}

/**
 * Returns a copy of the word with the fields every layer shares canonicalized: its language lowercased, and its annotation canonicalized then dropped when empty.
 * Each layer's `canonicalizeWord` builds on this to handle its own fields.
 */
public fun canonicalizeWordShared(word: StorageWord): StorageWord {
    return word.copy(
        language = lowerTag(word.language),
        annotation = canonicalizeField(word.annotation, ::canonicalizeWordAnnotation),
    )
}

/**
 * Returns a copy of the word with the fields every layer shares canonicalized: its language lowercased, and its annotation canonicalized then dropped when empty.
 * Each layer's `canonicalizeWord` builds on this to handle its own fields.
 */
public fun canonicalizeWordShared(word: RuntimeWord): RuntimeWord {
    return word.copy(
        language = lowerTag(word.language),
        annotation = canonicalizeField(word.annotation, ::canonicalizeWordAnnotation),
    )
}

/**
 * Resolves an annotation item's effective time, following the inheritance chain: its own time, else the annotated word's.
 */
public fun resolveAnnotationItemTime(item: WordAnnotationRoman, word: StorageWord): TimeRange? {
    return item.time ?: word.time
}

/**
 * Resolves an annotation item's effective time, following the inheritance chain: its own time, else the annotated word's.
 */
public fun resolveAnnotationItemTime(item: WordAnnotationRoman, word: RuntimeWord): TimeRange? {
    return item.time ?: word.time
}

/**
 * Resolves an annotation item's effective time, following the inheritance chain: its own time, else the annotated word's.
 */
public fun resolveAnnotationItemTime(item: WordAnnotationRuby, word: StorageWord): TimeRange? {
    return item.time ?: word.time
}

/**
 * Resolves an annotation item's effective time, following the inheritance chain: its own time, else the annotated word's.
 */
public fun resolveAnnotationItemTime(item: WordAnnotationRuby, word: RuntimeWord): TimeRange? {
    return item.time ?: word.time
}

/**
 * Resolves an annotation token's effective time, following the inheritance chain: its own time, else its item's, else the annotated word's.
 */
public fun resolveAnnotationTokenTime(token: WordAnnotationToken, item: WordAnnotationRoman, word: StorageWord): TimeRange? {
    return token.time ?: resolveAnnotationItemTime(item, word)
}

/**
 * Resolves an annotation token's effective time, following the inheritance chain: its own time, else its item's, else the annotated word's.
 */
public fun resolveAnnotationTokenTime(token: WordAnnotationToken, item: WordAnnotationRoman, word: RuntimeWord): TimeRange? {
    return token.time ?: resolveAnnotationItemTime(item, word)
}

/**
 * Resolves an annotation token's effective time, following the inheritance chain: its own time, else its item's, else the annotated word's.
 */
public fun resolveAnnotationTokenTime(token: WordAnnotationToken, item: WordAnnotationRuby, word: StorageWord): TimeRange? {
    return token.time ?: resolveAnnotationItemTime(item, word)
}

/**
 * Resolves an annotation token's effective time, following the inheritance chain: its own time, else its item's, else the annotated word's.
 */
public fun resolveAnnotationTokenTime(token: WordAnnotationToken, item: WordAnnotationRuby, word: RuntimeWord): TimeRange? {
    return token.time ?: resolveAnnotationItemTime(item, word)
}

/**
 * Joins the text of words in order, which restores the source text since separators are words of their own.
 */
@JvmName("getStorageWordsText")
public fun getWordsText(words: List<StorageWord>): String {
    return words.joinToString("") { it.text }
}

/**
 * Joins the text of words in order, which restores the source text since separators are words of their own.
 */
@JvmName("getRuntimeWordsText")
public fun getWordsText(words: List<RuntimeWord>): String {
    return words.joinToString("") { it.text }
}

/**
 * Collects the distinct lowercased language tags of normal words, in order of first appearance.
 */
@JvmName("getStorageWordsLanguages")
public fun getWordsLanguages(words: List<StorageWord>): List<String> {
    return words.filter { it.type == WordType.WORD_TYPE_NORMAL }.mapNotNull { lowerTag(it.language) }.distinct()
}

/**
 * Collects the distinct lowercased language tags of normal words, in order of first appearance.
 */
@JvmName("getRuntimeWordsLanguages")
public fun getWordsLanguages(words: List<RuntimeWord>): List<String> {
    return words.filter { it.type == WordType.WORD_TYPE_NORMAL }.mapNotNull { lowerTag(it.language) }.distinct()
}

/**
 * Joins the text of an annotation item's tokens with nothing in between, as they compose the item in order.
 */
public fun getAnnotationItemText(item: WordAnnotationRoman): String {
    return item.tokens.joinToString("") { it.text }
}

/**
 * Joins the text of an annotation item's tokens with nothing in between, as they compose the item in order.
 */
public fun getAnnotationItemText(item: WordAnnotationRuby): String {
    return item.tokens.joinToString("") { it.text }
}
