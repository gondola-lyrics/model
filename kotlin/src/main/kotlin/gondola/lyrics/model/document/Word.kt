@file:JvmName("WordHelper")

package gondola.lyrics.model.document

import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.utils.canonicalizeField
import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.findDuplicates
import gondola.lyrics.model.utils.getAnnotationKey
import gondola.lyrics.model.utils.isTimeRangeUncovered
import gondola.lyrics.model.utils.isUnresolved
import gondola.lyrics.model.utils.lowerTag

// Java whitespace classes differ from Unicode White_Space.
private val separator = Regex("[\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]")
private val onlySeparators = Regex("${separator.pattern}+")

/**
 * Reports whether word timing constraints apply.
 */
private fun ownsWordTimes(timing: TimingLevel): Boolean {
    return timing != TimingLevel.TIMING_LEVEL_NONE && timing != TimingLevel.TIMING_LEVEL_LINE
}

/**
 * Creates a ruby or roman fragment with optional timing.
 */
public fun makeDocumentWordAnnotationToken(time: TimeRange? = null, text: String = ""): WordAnnotationToken {
    return WordAnnotationToken(time = time, text = text)
}

/**
 * Creates a word romanization without normalizing its language or scheme.
 */
public fun makeDocumentWordAnnotationRoman(
    time: TimeRange? = null,
    language: String? = null,
    scheme: String? = null,
    tokens: List<WordAnnotationToken> = emptyList(),
): WordAnnotationRoman {
    return WordAnnotationRoman(time = time, language = language, scheme = scheme, tokens = tokens)
}

/**
 * Creates a translation of a whole word.
 */
public fun makeDocumentWordAnnotationTranslation(language: String? = null, text: String = ""): WordAnnotationTranslation {
    return WordAnnotationTranslation(language = language, text = text)
}

/**
 * Creates a ruby annotation without normalizing its language or scheme.
 */
public fun makeDocumentWordAnnotationRuby(
    time: TimeRange? = null,
    language: String? = null,
    scheme: String? = null,
    tokens: List<WordAnnotationToken> = emptyList(),
): WordAnnotationRuby {
    return WordAnnotationRuby(time = time, language = language, scheme = scheme, tokens = tokens)
}

/**
 * Creates word annotations from the supplied lists.
 */
public fun makeDocumentWordAnnotation(
    rubies: List<WordAnnotationRuby> = emptyList(),
    romans: List<WordAnnotationRoman> = emptyList(),
    translations: List<WordAnnotationTranslation> = emptyList(),
): WordAnnotation {
    return WordAnnotation(rubies = rubies, romans = romans, translations = translations)
}

/**
 * Checks annotation uniqueness, valid time ranges, and containment within inherited timing.
 */
public fun validateDocumentWordAnnotation(annotation: WordAnnotation, path: String = "", time: TimeRange? = null): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()

    fun validateItem(itemTime: TimeRange?, tokens: List<WordAnnotationToken>, itemPath: String) {
        if (itemTime != null) {
            diagnostics.addAll(validateTimeRange(itemTime, childPath(itemPath, "time")))
        }
        // Annotation timing follows the same vocal event as the word.
        if (isTimeRangeUncovered(itemTime, time)) {
            diagnostics.add(Diagnostic(childPath(itemPath, "time"), DiagnosticCode.LineWordAnnotationTimeUncovered))
        }
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
    findDuplicates(annotation.rubies) { getAnnotationKey(it.language, it.scheme) }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "rubies[$index]"), DiagnosticCode.LineWordAnnotationRubiesDuplicate))
    }
    findDuplicates(annotation.romans) { getAnnotationKey(it.language, it.scheme) }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "romans[$index]"), DiagnosticCode.LineWordAnnotationRomansDuplicate))
    }
    findDuplicates(annotation.translations) { lowerTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "translations[$index]"), DiagnosticCode.LineWordAnnotationTranslationsLanguageDuplicate))
    }
    annotation.rubies.forEachIndexed { index, item ->
        validateItem(item.time, item.tokens, childPath(path, "rubies[$index]"))
    }
    annotation.romans.forEachIndexed { index, item ->
        validateItem(item.time, item.tokens, childPath(path, "romans[$index]"))
    }
    return diagnostics
}

/**
 * Checks the word kind, text, permitted fields, annotations, and timing.
 *
 * The declared timing level determines whether annotation timing is constrained by the word.
 */
public fun validateDocumentWord(word: Word, path: String = "", timing: TimingLevel = TimingLevel.TIMING_LEVEL_UNSPECIFIED): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (isUnresolved(word.type)) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.WordTypeUnspecified))
    }
    if (word.type == WordType.WORD_TYPE_NORMAL && word.text.isEmpty()) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.WordTextEmpty))
    } else if (word.type == WordType.WORD_TYPE_NORMAL && separator.containsMatchIn(word.text)) {
        // Separators belong in adjacent SPACE words.
        diagnostics.add(Diagnostic(childPath(path, "text"), DiagnosticCode.WordTextSeparator))
    }
    if (word.type == WordType.WORD_TYPE_SPACE) {
        if (!onlySeparators.matches(word.text)) {
            diagnostics.add(Diagnostic(childPath(path, "text"), DiagnosticCode.WordTextNotSeparator))
        }
        // Forbidden fields are reported once without validating their contents.
        if (word.time != null) {
            diagnostics.add(Diagnostic(childPath(path, "time"), DiagnosticCode.LineWordTimeUnexpected))
        }
        if (word.language != null) {
            diagnostics.add(Diagnostic(childPath(path, "language"), DiagnosticCode.LineWordLanguageUnexpected))
        }
        if (word.annotation != null) {
            diagnostics.add(Diagnostic(childPath(path, "annotation"), DiagnosticCode.LineWordAnnotationUnexpected))
        }
        if (word.emphasis != null) {
            diagnostics.add(Diagnostic(childPath(path, "emphasis"), DiagnosticCode.LineWordEmphasisUnexpected))
        }
        return diagnostics
    }
    if (word.time != null) {
        diagnostics.addAll(validateTimeRange(word.time, childPath(path, "time")))
    }
    if (word.annotation != null) {
        // NONE and LINE timing validate the word list at the lyric level.
        diagnostics.addAll(validateDocumentWordAnnotation(word.annotation, childPath(path, "annotation"), word.time.takeIf { ownsWordTimes(timing) }))
    }
    return diagnostics
}

/**
 * Validates each word and, when word timing applies, requires sung-word times within the enclosing range.
 */
public fun validateDocumentWords(
    words: List<Word>,
    time: TimeRange?,
    path: String = "",
    timing: TimingLevel = TimingLevel.TIMING_LEVEL_UNSPECIFIED,
): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val ownTimes = ownsWordTimes(timing)
    words.forEachIndexed { index, word ->
        val wordPath = childPath(path, "words[$index]")
        diagnostics.addAll(validateDocumentWord(word, wordPath, timing))
        if (ownTimes && word.type == WordType.WORD_TYPE_NORMAL && word.time == null) {
            diagnostics.add(Diagnostic(wordPath, DiagnosticCode.LineWordTimeMissing))
        }
        // SPACE timing is already reported as forbidden.
        if (ownTimes && word.type != WordType.WORD_TYPE_SPACE && isTimeRangeUncovered(word.time, time)) {
            diagnostics.add(Diagnostic(childPath(wordPath, "time"), DiagnosticCode.LineWordTimeUncovered))
        }
    }
    return diagnostics
}

/**
 * Returns the immutable token unchanged.
 */
public fun canonicalizeDocumentWordAnnotationToken(token: WordAnnotationToken): WordAnnotationToken {
    return token
}

/**
 * Lowercases language and scheme and canonicalizes roman tokens.
 */
public fun canonicalizeDocumentWordAnnotationRoman(roman: WordAnnotationRoman): WordAnnotationRoman {
    return roman.copy(
        language = lowerTag(roman.language),
        scheme = lowerTag(roman.scheme),
        tokens = canonicalizeList(roman.tokens, ::canonicalizeDocumentWordAnnotationToken),
    )
}

/**
 * Lowercases language and scheme and canonicalizes ruby tokens.
 */
public fun canonicalizeDocumentWordAnnotationRuby(ruby: WordAnnotationRuby): WordAnnotationRuby {
    return ruby.copy(
        language = lowerTag(ruby.language),
        scheme = lowerTag(ruby.scheme),
        tokens = canonicalizeList(ruby.tokens, ::canonicalizeDocumentWordAnnotationToken),
    )
}

/**
 * Lowercases the translation's language tag.
 */
public fun canonicalizeDocumentWordAnnotationTranslation(translation: WordAnnotationTranslation): WordAnnotationTranslation {
    return translation.copy(language = lowerTag(translation.language))
}

/**
 * Canonicalizes annotations and drops all-default list entries.
 */
public fun canonicalizeDocumentWordAnnotation(annotation: WordAnnotation): WordAnnotation {
    return annotation.copy(
        rubies = canonicalizeList(annotation.rubies, ::canonicalizeDocumentWordAnnotationRuby),
        romans = canonicalizeList(annotation.romans, ::canonicalizeDocumentWordAnnotationRoman),
        translations = canonicalizeList(annotation.translations, ::canonicalizeDocumentWordAnnotationTranslation),
    )
}

/**
 * Uses the annotation's time, falling back to the annotated word.
 */
public fun resolveDocumentAnnotationItemTime(item: WordAnnotationRoman, word: Word): TimeRange? {
    return item.time ?: word.time
}

/**
 * Uses the annotation's time, falling back to the annotated word.
 */
public fun resolveDocumentAnnotationItemTime(item: WordAnnotationRuby, word: Word): TimeRange? {
    return item.time ?: word.time
}

/**
 * Uses the token's time, then its annotation's time, then the annotated word.
 */
public fun resolveDocumentAnnotationTokenTime(token: WordAnnotationToken, item: WordAnnotationRoman, word: Word): TimeRange? {
    return token.time ?: resolveDocumentAnnotationItemTime(item, word)
}

/**
 * Uses the token's time, then its annotation's time, then the annotated word.
 */
public fun resolveDocumentAnnotationTokenTime(token: WordAnnotationToken, item: WordAnnotationRuby, word: Word): TimeRange? {
    return token.time ?: resolveDocumentAnnotationItemTime(item, word)
}

/**
 * Joins word text in order, including separator words.
 */
public fun getDocumentWordsText(words: List<Word>): String {
    return words.joinToString("") { it.text }
}

/**
 * Returns distinct lowercase language tags from normal words in first-appearance order.
 */
public fun getDocumentWordsLanguages(words: List<Word>): List<String> {
    return words.filter { it.type == WordType.WORD_TYPE_NORMAL }.mapNotNull { lowerTag(it.language) }.distinct()
}

/**
 * Joins annotation tokens in order without adding separators.
 */
public fun getDocumentAnnotationItemText(item: WordAnnotationRoman): String {
    return item.tokens.joinToString("") { it.text }
}

/**
 * Joins annotation tokens in order without adding separators.
 */
public fun getDocumentAnnotationItemText(item: WordAnnotationRuby): String {
    return item.tokens.joinToString("") { it.text }
}

/**
 * Creates a normal word with a fixed WORD_TYPE_NORMAL discriminator.
 */
public fun makeDocumentWordNormal(
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
 * Creates a WORD_TYPE_SPACE word containing only the supplied separator.
 */
public fun makeDocumentWordSpace(text: String = ""): Word {
    return Word(type = WordType.WORD_TYPE_SPACE, text = text)
}

/**
 * Normalizes language and annotations, preserving explicit emphasis values.
 */
public fun canonicalizeDocumentWord(word: Word): Word {
    return word.copy(
        language = lowerTag(word.language),
        annotation = canonicalizeField(word.annotation, ::canonicalizeDocumentWordAnnotation),
    )
}
