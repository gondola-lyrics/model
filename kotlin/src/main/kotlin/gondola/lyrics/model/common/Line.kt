@file:JvmName("LineHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.findDuplicates
import gondola.lyrics.model.utils.lowerTag
import gondola.lyrics.model.runtime.Line as RuntimeLine
import gondola.lyrics.model.runtime.LineBackground as RuntimeLineBackground
import gondola.lyrics.model.runtime.LineContent as RuntimeLineContent
import gondola.lyrics.model.storage.Line as StorageLine
import gondola.lyrics.model.storage.LineBackground as StorageLineBackground
import gondola.lyrics.model.storage.LineContent as StorageLineContent

private fun validateContentFields(hasWords: Boolean, text: String?, path: String, required: Boolean): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val contentPath = childPath(path, "content")
    if (required && !hasWords && text == null) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.LineContentMissing))
    } else if (hasWords && text != null) {
        diagnostics.add(Diagnostic(contentPath, DiagnosticCode.LineContentAmbiguous))
    }
    // An empty text is set as far as the two-of-one rule is concerned, and so would otherwise stand in for a line with nothing in it.
    if (text == "") {
        diagnostics.add(Diagnostic(childPath(contentPath, "text"), DiagnosticCode.LineContentTextEmpty))
    }
    return diagnostics
}

/**
 * Validates a normal line's or background line's content: exactly one of `words` or `text` must be set, the text must be non-empty when it is the one set, and its words must be valid.
 * `timing` is the lyric's declared precision, which its words need in order to know whether they own their times.
 * `required` is false where the line's kind is unresolved, so absent content goes unreported while what is present is still checked.
 */
public fun validateContent(
    content: StorageLineContent?,
    time: TimeRange?,
    path: String = "",
    timing: Timing = Timing.TIMING_UNSPECIFIED,
    required: Boolean = true,
): List<Diagnostic> = validateContentFields((content?.wordsCount ?: 0) > 0, content?.text?.takeIf { content.hasText() }, path, required) +
    validateWords(content?.wordsList ?: emptyList(), time, childPath(path, "content"), timing)

/**
 * Validates a normal line's or background line's content: exactly one of `words` or `text` must be set, the text must be non-empty when it is the one set, and its words must be valid.
 * `timing` is the lyric's declared precision, which its words need in order to know whether they own their times.
 * `required` is false where the line's kind is unresolved, so absent content goes unreported while what is present is still checked.
 */
public fun validateContent(
    content: RuntimeLineContent?,
    time: TimeRange?,
    path: String = "",
    timing: Timing = Timing.TIMING_UNSPECIFIED,
    required: Boolean = true,
): List<Diagnostic> = validateContentFields((content?.wordsCount ?: 0) > 0, content?.text?.takeIf { content.hasText() }, path, required) +
    validateWords(content?.wordsList ?: emptyList(), time, childPath(path, "content"), timing)

/**
 * Returns a line's text: its plain text when it carries that, otherwise its words joined.
 */
public fun getContentText(content: StorageLineContent?): String =
    content?.text?.takeIf { content.hasText() } ?: getWordsText(content?.wordsList ?: emptyList())

/**
 * Returns a line's text: its plain text when it carries that, otherwise its words joined.
 */
public fun getContentText(content: RuntimeLineContent?): String =
    content?.text?.takeIf { content.hasText() } ?: getWordsText(content?.wordsList ?: emptyList())

/**
 * Reports whether a line is word-level, i.e. its content carries words rather than plain text; an instrumental or text line is not.
 */
public fun isWordLevelLine(line: StorageLine): Boolean = line.content.wordsCount > 0

/**
 * Reports whether a line is word-level, i.e. its content carries words rather than plain text; an instrumental or text line is not.
 */
public fun isWordLevelLine(line: RuntimeLine): Boolean = line.content.wordsCount > 0

/**
 * Reports whether a line is word-level, i.e. its content carries words rather than plain text; an instrumental or text line is not.
 */
public fun isWordLevelLine(line: StorageLineBackground): Boolean = line.content.wordsCount > 0

/**
 * Reports whether a line is word-level, i.e. its content carries words rather than plain text; an instrumental or text line is not.
 */
public fun isWordLevelLine(line: RuntimeLineBackground): Boolean = line.content.wordsCount > 0

/**
 * Derives the line's distinct lowercased language tags, falling back to those of its words when the line lists none.
 * Overloads serve a line and a background line of either layer.
 * It answers what one line shows, while `deriveLanguageUsages` unions line and word tags for the lyric-wide count.
 */
public fun deriveLineLanguages(line: StorageLine): List<String> =
    if (line.languagesCount == 0) getWordsLanguages(line.content.wordsList) else line.languagesList.mapNotNull(::lowerTag).distinct()

/**
 * Derives the line's distinct lowercased language tags, falling back to those of its words when the line lists none.
 * Overloads serve a line and a background line of either layer.
 * It answers what one line shows, while `deriveLanguageUsages` unions line and word tags for the lyric-wide count.
 */
public fun deriveLineLanguages(line: RuntimeLine): List<String> =
    if (line.languagesCount == 0) getWordsLanguages(line.content.wordsList) else line.languagesList.mapNotNull(::lowerTag).distinct()

/**
 * Derives the line's distinct lowercased language tags, falling back to those of its words when the line lists none.
 * Overloads serve a line and a background line of either layer.
 * It answers what one line shows, while `deriveLanguageUsages` unions line and word tags for the lyric-wide count.
 */
public fun deriveLineLanguages(line: StorageLineBackground): List<String> =
    if (line.languagesCount == 0) getWordsLanguages(line.content.wordsList) else line.languagesList.mapNotNull(::lowerTag).distinct()

/**
 * Derives the line's distinct lowercased language tags, falling back to those of its words when the line lists none.
 * Overloads serve a line and a background line of either layer.
 * It answers what one line shows, while `deriveLanguageUsages` unions line and word tags for the lyric-wide count.
 */
public fun deriveLineLanguages(line: RuntimeLineBackground): List<String> =
    if (line.languagesCount == 0) getWordsLanguages(line.content.wordsList) else line.languagesList.mapNotNull(::lowerTag).distinct()

/**
 * Creates a LineAnnotation, the per-line annotation container.
 */
public fun makeLineAnnotation(
    romans: List<LineAnnotationRoman> = emptyList(),
    translations: List<LineAnnotationTranslation> = emptyList(),
): LineAnnotation = LineAnnotation.newBuilder().addAllRomans(romans).addAllTranslations(translations).build()

/**
 * Validates a LineAnnotation: each of its lists holds one entry per language, so a language may not repeat within one.
 */
public fun validateLineAnnotation(annotation: LineAnnotation, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    // Reports every entry of one list whose language an earlier entry already took, treating an unset and an empty tag as the same default language.
    findDuplicates(annotation.romansList) { lowerTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "romans[$index]"), DiagnosticCode.LineAnnotationRomansLanguageDuplicate))
    }
    findDuplicates(annotation.translationsList) { lowerTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "translations[$index]"), DiagnosticCode.LineAnnotationTranslationsLanguageDuplicate))
    }
    return diagnostics
}

/**
 * Creates a LineAnnotationRoman, a romanized transliteration of a whole line.
 */
public fun makeLineAnnotationRoman(language: String? = null, text: String = ""): LineAnnotationRoman = LineAnnotationRoman.newBuilder().apply {
    if (language != null) {
        setLanguage(language)
    }
    setText(text)
}.build()

/**
 * Creates a LineAnnotationTranslation, a translation of a whole line.
 */
public fun makeLineAnnotationTranslation(language: String? = null, text: String = ""): LineAnnotationTranslation =
    LineAnnotationTranslation.newBuilder().apply {
        if (language != null) {
            setLanguage(language)
        }
        setText(text)
    }.build()

/**
 * Returns a copy of the roman annotation with its language lowercased.
 */
public fun canonicalizeLineAnnotationRoman(roman: LineAnnotationRoman): LineAnnotationRoman = roman.toBuilder().apply {
    clearLanguage()
    lowerTag(roman.language)?.let { setLanguage(it) }
}.build()

/**
 * Returns a copy of the translation annotation with its language lowercased.
 */
public fun canonicalizeLineAnnotationTranslation(translation: LineAnnotationTranslation): LineAnnotationTranslation = translation.toBuilder().apply {
    clearLanguage()
    lowerTag(translation.language)?.let { setLanguage(it) }
}.build()

/**
 * Returns a copy of the annotation with both its lists canonicalized and all-default entries dropped.
 */
public fun canonicalizeLineAnnotation(annotation: LineAnnotation): LineAnnotation = annotation.toBuilder().apply {
    clearRomans()
    addAllRomans(canonicalizeList(annotation.romansList, ::canonicalizeLineAnnotationRoman))
    clearTranslations()
    addAllTranslations(canonicalizeList(annotation.translationsList, ::canonicalizeLineAnnotationTranslation))
}.build()

private fun deriveWordRomans(words: List<WordView>): List<LineAnnotationRoman> {
    val languages = words.flatMap { word -> word.annotation?.romansList?.map { lowerTag(it.language) } ?: emptyList() }.distinct()
    val romans = mutableListOf<LineAnnotationRoman>()
    for (language in languages) {
        val joined = StringBuilder()
        var spaced = false
        for (word in words) {
            if (word.type == WordType.WORD_TYPE_SPACE) {
                spaced = true
                continue
            }
            val roman = word.annotation?.romansList?.firstOrNull { lowerTag(it.language) == language }
            val text = roman?.let(::getAnnotationItemText) ?: ""
            if (text.isNotEmpty()) {
                if (joined.isNotEmpty() && spaced) {
                    joined.append(' ')
                }
                joined.append(text)
                spaced = false
            }
        }
        if (joined.isNotEmpty()) {
            romans.add(makeLineAnnotationRoman(language, joined.toString()))
        }
    }
    return romans
}

/**
 * Derives line-level romans from the content's words, one per language in order of first appearance; the result is for display and must never be stored on the line.
 * Words lacking a roman in that language are skipped, and any spaces between two romanized words collapse to a single U+0020.
 */
public fun deriveLineRomans(content: StorageLineContent?): List<LineAnnotationRoman> =
    deriveWordRomans(content?.wordsList?.map { it.asWordView() } ?: emptyList())

/**
 * Derives line-level romans from the content's words, one per language in order of first appearance; the result is for display and must never be stored on the line.
 * Words lacking a roman in that language are skipped, and any spaces between two romanized words collapse to a single U+0020.
 */
public fun deriveLineRomans(content: RuntimeLineContent?): List<LineAnnotationRoman> =
    deriveWordRomans(content?.wordsList?.map { it.asWordView() } ?: emptyList())
