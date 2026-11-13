@file:JvmName("WordHelper")

package gondola.lyrics.model.enriched

import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.TextToken
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.common.canonicalizeTextToken
import gondola.lyrics.model.common.validateLanguageTag
import gondola.lyrics.model.common.validateTextToken
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.utils.canonicalizeField
import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.findDefaultEntries
import gondola.lyrics.model.utils.findDuplicateIndices
import gondola.lyrics.model.utils.getAnnotationVariantKey
import gondola.lyrics.model.utils.isTimeRangeUncovered
import gondola.lyrics.model.utils.isUnresolved
import gondola.lyrics.model.utils.lowerNonEmptyTag
import gondola.lyrics.model.utils.unsetIfDefault

// Java whitespace classes differ from Unicode White_Space.
private val separator = Regex("[\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]")
private val onlySeparators = Regex("${separator.pattern}+")

/**
 * Reports whether word timing constraints apply.
 */
private fun appliesLocalWordTimeConstraint(timing: TimingLevel): Boolean {
    return timing != TimingLevel.TIMING_LEVEL_NONE && timing != TimingLevel.TIMING_LEVEL_LINE
}

/**
 * Creates a word romanization without normalizing its language or scheme.
 */
public fun makeEnrichedWordAnnotationRoman(
    time: TimeRange? = null,
    language: String? = null,
    scheme: String? = null,
    tokens: List<TextToken> = emptyList(),
): WordAnnotationRoman {
    return WordAnnotationRoman(time = time, language = language, scheme = scheme, tokens = tokens)
}

/**
 * Creates a translation of a whole word.
 */
public fun makeEnrichedWordAnnotationTranslation(language: String? = null, text: String = ""): WordAnnotationTranslation {
    return WordAnnotationTranslation(language = language, text = text)
}

/**
 * Creates a ruby annotation without normalizing its language or scheme.
 */
public fun makeEnrichedWordAnnotationRuby(
    time: TimeRange? = null,
    language: String? = null,
    scheme: String? = null,
    tokens: List<TextToken> = emptyList(),
): WordAnnotationRuby {
    return WordAnnotationRuby(time = time, language = language, scheme = scheme, tokens = tokens)
}

/**
 * Creates word annotations from the supplied lists.
 */
public fun makeEnrichedWordAnnotation(
    rubies: List<WordAnnotationRuby> = emptyList(),
    romans: List<WordAnnotationRoman> = emptyList(),
    translations: List<WordAnnotationTranslation> = emptyList(),
): WordAnnotation {
    return WordAnnotation(rubies = rubies, romans = romans, translations = translations)
}

/**
 * Checks annotation languages, repeated entries, uniqueness, and time containment.
 *
 * Paths are relative to the annotation; containment uses the supplied parent-word range.
 */
public fun validateEnrichedWordAnnotation(annotation: WordAnnotation, path: String = "", time: TimeRange? = null): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()

    fun validateItem(itemTime: TimeRange?, language: String?, tokens: List<TextToken>, itemPath: String) {
        diagnostics.addAll(validateLanguageTag(language, childPath(itemPath, "language")))
        if (itemTime != null) {
            diagnostics.addAll(validateTimeRange(itemTime, childPath(itemPath, "time")))
        }
        // Annotation timing follows the same vocal event as the word.
        if (isTimeRangeUncovered(itemTime, time)) {
            diagnostics.add(Diagnostic(childPath(itemPath, "time"), DiagnosticCode.LineWordAnnotationTimeUncovered))
        }
        val inherited = itemTime ?: time
        tokens.forEachIndexed { index, token ->
            val tokenPath = childPath(itemPath, "tokens[$index]")
            diagnostics.addAll(validateTextToken(token, tokenPath))
            if (isTimeRangeUncovered(token.time, inherited)) {
                diagnostics.add(Diagnostic(childPath(tokenPath, "time"), DiagnosticCode.LineWordAnnotationTimeUncovered))
            }
        }
    }
    findDuplicateIndices(annotation.rubies) { getAnnotationVariantKey(it.language, it.scheme) }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "rubies[$index]"), DiagnosticCode.LineWordAnnotationRubiesDuplicate))
    }
    findDuplicateIndices(annotation.romans) { getAnnotationVariantKey(it.language, it.scheme) }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "romans[$index]"), DiagnosticCode.LineWordAnnotationRomansDuplicate))
    }
    findDuplicateIndices(annotation.translations) { lowerNonEmptyTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "translations[$index]"), DiagnosticCode.LineWordAnnotationTranslationsLanguageDuplicate))
    }
    annotation.rubies.forEachIndexed { index, item ->
        validateItem(item.time, item.language, item.tokens, childPath(path, "rubies[$index]"))
    }
    annotation.romans.forEachIndexed { index, item ->
        validateItem(item.time, item.language, item.tokens, childPath(path, "romans[$index]"))
    }
    annotation.translations.forEachIndexed { index, item ->
        diagnostics.addAll(validateLanguageTag(item.language, childPath(path, "translations[$index].language")))
    }
    findDefaultEntries(annotation, diagnostics.map { it.path }, path).forEach { entryPath ->
        diagnostics.add(Diagnostic(entryPath, DiagnosticCode.LyricListEntryEmpty))
    }
    return diagnostics
}

/**
 * Checks the word kind, text, permitted fields, annotations, and timing.
 *
 * Paths are relative to the word unless its location is supplied.
 * NONE forbids original timing; NONE and LINE suppress required word timing and parent-word annotation containment.
 * Unspecified timing retains the word-level checks used by the word-list validator.
 */
public fun validateEnrichedWord(word: Word, path: String = "", timing: TimingLevel = TimingLevel.TIMING_LEVEL_UNSPECIFIED): List<Diagnostic> {
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
    diagnostics.addAll(validateLanguageTag(word.language, childPath(path, "language")))
    if (appliesLocalWordTimeConstraint(timing) && word.type == WordType.WORD_TYPE_NORMAL && word.time == null) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.LineWordTimeMissing))
    }
    if (word.time != null) {
        if (timing == TimingLevel.TIMING_LEVEL_NONE) {
            diagnostics.add(Diagnostic(childPath(path, "time"), DiagnosticCode.LyricTimingNonePresent))
        }
        diagnostics.addAll(validateTimeRange(word.time, childPath(path, "time")))
    }
    if (word.annotation != null) {
        diagnostics.addAll(
            validateEnrichedWordAnnotation(
                word.annotation,
                childPath(path, "annotation"),
                word.time.takeIf {
                    appliesLocalWordTimeConstraint(timing)
                },
            ),
        )
    }
    val emphasis = word.emphasis
    if (emphasis?.derived != null && emphasis.value == null) {
        diagnostics.add(Diagnostic(childPath(path, "emphasis.value"), DiagnosticCode.LineWordEmphasisValueMissing))
    }
    return diagnostics
}

/**
 * Validates words and, when word timing applies, checks containment within the supplied line range.
 *
 * Paths are relative to the word list; only an index is appended to its supplied location.
 */
public fun validateEnrichedWords(
    words: List<Word>,
    time: TimeRange?,
    path: String = "",
    timing: TimingLevel = TimingLevel.TIMING_LEVEL_UNSPECIFIED,
): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val ownTimes = appliesLocalWordTimeConstraint(timing)
    words.forEachIndexed { index, word ->
        val wordPath = "$path[$index]"
        diagnostics.addAll(validateEnrichedWord(word, wordPath, timing))
        // SPACE timing is already reported as forbidden.
        if (ownTimes && word.type != WordType.WORD_TYPE_SPACE && isTimeRangeUncovered(word.time, time)) {
            diagnostics.add(Diagnostic(childPath(wordPath, "time"), DiagnosticCode.LineWordTimeUncovered))
        }
    }
    return diagnostics
}

/**
 * Lowercases language and scheme and canonicalizes roman tokens.
 */
public fun canonicalizeEnrichedWordAnnotationRoman(roman: WordAnnotationRoman): WordAnnotationRoman {
    return roman.copy(
        language = lowerNonEmptyTag(roman.language),
        scheme = lowerNonEmptyTag(roman.scheme),
        tokens = canonicalizeList(roman.tokens, ::canonicalizeTextToken),
    )
}

/**
 * Lowercases language and scheme and canonicalizes ruby tokens.
 */
public fun canonicalizeEnrichedWordAnnotationRuby(ruby: WordAnnotationRuby): WordAnnotationRuby {
    return ruby.copy(
        language = lowerNonEmptyTag(ruby.language),
        scheme = lowerNonEmptyTag(ruby.scheme),
        tokens = canonicalizeList(ruby.tokens, ::canonicalizeTextToken),
    )
}

/**
 * Lowercases the translation's language tag.
 */
public fun canonicalizeEnrichedWordAnnotationTranslation(translation: WordAnnotationTranslation): WordAnnotationTranslation {
    return translation.copy(language = lowerNonEmptyTag(translation.language))
}

/**
 * Canonicalizes annotations and drops all-default list entries.
 */
public fun canonicalizeEnrichedWordAnnotation(annotation: WordAnnotation): WordAnnotation {
    return annotation.copy(
        rubies = canonicalizeList(annotation.rubies, ::canonicalizeEnrichedWordAnnotationRuby),
        romans = canonicalizeList(annotation.romans, ::canonicalizeEnrichedWordAnnotationRoman),
        translations = canonicalizeList(annotation.translations, ::canonicalizeEnrichedWordAnnotationTranslation),
    )
}

/**
 * Uses the annotation's time, falling back to the annotated word.
 */
public fun resolveEnrichedWordAnnotationItemTime(item: WordAnnotationRoman, word: Word): TimeRange? {
    return item.time ?: word.time
}

/**
 * Uses the annotation's time, falling back to the annotated word.
 */
public fun resolveEnrichedWordAnnotationItemTime(item: WordAnnotationRuby, word: Word): TimeRange? {
    return item.time ?: word.time
}

/**
 * Uses the token's time, then its annotation's time, then the annotated word.
 */
public fun resolveEnrichedWordAnnotationTokenTime(token: TextToken, item: WordAnnotationRoman, word: Word): TimeRange? {
    return token.time ?: resolveEnrichedWordAnnotationItemTime(item, word)
}

/**
 * Uses the token's time, then its annotation's time, then the annotated word.
 */
public fun resolveEnrichedWordAnnotationTokenTime(token: TextToken, item: WordAnnotationRuby, word: Word): TimeRange? {
    return token.time ?: resolveEnrichedWordAnnotationItemTime(item, word)
}

/**
 * Joins word text in order, including separator words.
 */
public fun getEnrichedWordsText(words: List<Word>): String {
    return words.joinToString("") { it.text }
}

/**
 * Returns distinct lowercase language tags from normal words in first-appearance order.
 */
public fun collectEnrichedWordLanguages(words: List<Word>): List<String> {
    return words.filter { it.type == WordType.WORD_TYPE_NORMAL }.mapNotNull { lowerNonEmptyTag(it.language) }.distinct()
}

/**
 * Joins annotation tokens in order without adding separators.
 */
public fun getEnrichedWordAnnotationItemText(item: WordAnnotationRoman): String {
    return item.tokens.joinToString("") { it.text }
}

/**
 * Joins annotation tokens in order without adding separators.
 */
public fun getEnrichedWordAnnotationItemText(item: WordAnnotationRuby): String {
    return item.tokens.joinToString("") { it.text }
}

/**
 * Creates a normal word with a fixed WORD_TYPE_NORMAL discriminator.
 */
public fun makeEnrichedWordNormal(
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
 * Creates a WORD_TYPE_SPACE word containing only the supplied separator.
 */
public fun makeEnrichedWordSpace(text: String = ""): Word {
    return Word(type = WordType.WORD_TYPE_SPACE, text = text)
}

/**
 * Creates an emphasis decision, preserving absent fields and explicit false values.
 */
public fun makeEnrichedWordEmphasis(value: Boolean? = null, derived: Boolean? = null): WordEmphasis {
    return WordEmphasis(value = value, derived = derived)
}

/**
 * Normalizes language and annotations, preserving explicit emphasis values.
 */
public fun canonicalizeEnrichedWord(word: Word): Word {
    return word.copy(
        language = lowerNonEmptyTag(word.language),
        annotation = canonicalizeField(word.annotation, ::canonicalizeEnrichedWordAnnotation),
        emphasis = unsetIfDefault(word.emphasis),
    )
}
