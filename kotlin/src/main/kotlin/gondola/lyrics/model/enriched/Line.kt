@file:JvmName("LineHelper")

package gondola.lyrics.model.enriched

import gondola.lyrics.model.common.Agent
import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.Part
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.resolveAgents
import gondola.lyrics.model.common.validateLineTags
import gondola.lyrics.model.common.validatePart
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.utils.byTime
import gondola.lyrics.model.utils.canonicalizeField
import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.dropDefault
import gondola.lyrics.model.utils.findDuplicates
import gondola.lyrics.model.utils.findUnordered
import gondola.lyrics.model.utils.getAnnotationKey
import gondola.lyrics.model.utils.getTimeRangeEnd
import gondola.lyrics.model.utils.isTimeRangeOrdered
import gondola.lyrics.model.utils.isUnresolved
import gondola.lyrics.model.utils.lowerTag

private fun validateContentFields(hasWords: Boolean, text: String?, path: String, required: Boolean): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val contentPath = childPath(path, "content")
    if (required && !hasWords && text == null) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.LineContentMissing))
    } else if (hasWords && text != null) {
        diagnostics.add(Diagnostic(contentPath, DiagnosticCode.LineContentAmbiguous))
    }
    // Empty text still counts as present for exclusivity.
    if (text == "") {
        diagnostics.add(Diagnostic(childPath(contentPath, "text"), DiagnosticCode.LineContentTextEmpty))
    }
    return diagnostics
}

/**
 * Checks that exactly one non-empty content form is present and validates its words.
 *
 * An unresolved line kind may omit content when required is false.
 */
public fun validateEnrichedLineContent(
    content: LineContent?,
    time: TimeRange?,
    path: String = "",
    timing: Timing = Timing.TIMING_UNSPECIFIED,
    required: Boolean = true,
): List<Diagnostic> {
    return validateContentFields(!content?.words.isNullOrEmpty(), content?.text, path, required) +
        validateEnrichedWords(content?.words.orEmpty(), time, childPath(path, "content"), timing)
}

/**
 * Returns plain text when present, otherwise joins the content's words.
 */
public fun getEnrichedLineContentText(content: LineContent?): String {
    return content?.text ?: getEnrichedWordsText(content?.words.orEmpty())
}

/**
 * Reports whether the line contains words.
 */
public fun isEnrichedWordLevelLine(line: Line): Boolean {
    return !line.content?.words.isNullOrEmpty()
}

/**
 * Reports whether the line contains words.
 */
public fun isEnrichedWordLevelLine(line: LineBackground): Boolean {
    return !line.content?.words.isNullOrEmpty()
}

/**
 * Returns distinct lowercase line languages, using normal-word languages when the line declares none.
 */
public fun deriveEnrichedLineLanguages(line: Line): List<String> {
    return if (line.languages.isEmpty()) {
        getEnrichedWordsLanguages(
            line.content?.words.orEmpty(),
        )
    } else {
        line.languages.mapNotNull(::lowerTag).distinct()
    }
}

/**
 * Returns distinct lowercase line languages, using normal-word languages when the line declares none.
 */
public fun deriveEnrichedLineLanguages(line: LineBackground): List<String> {
    return if (line.languages.isEmpty()) {
        getEnrichedWordsLanguages(
            line.content?.words.orEmpty(),
        )
    } else {
        line.languages.mapNotNull(::lowerTag).distinct()
    }
}

/**
 * Creates annotations explicitly attached to a whole line.
 */
public fun makeEnrichedLineAnnotation(
    romans: List<LineAnnotationRoman> = emptyList(),
    translations: List<LineAnnotationTranslation> = emptyList(),
): LineAnnotation {
    return LineAnnotation(romans = romans, translations = translations)
}

/**
 * Checks roman uniqueness by language and scheme and translation uniqueness by language.
 */
public fun validateEnrichedLineAnnotation(annotation: LineAnnotation, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    findDuplicates(annotation.romans) { getAnnotationKey(it.language, it.scheme) }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "romans[$index]"), DiagnosticCode.LineAnnotationRomansDuplicate))
    }
    findDuplicates(annotation.translations) { lowerTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "translations[$index]"), DiagnosticCode.LineAnnotationTranslationsLanguageDuplicate))
    }
    return diagnostics
}

/**
 * Creates a whole-line romanization without normalizing its language or scheme.
 */
public fun makeEnrichedLineAnnotationRoman(language: String? = null, text: String = "", scheme: String? = null): LineAnnotationRoman {
    return LineAnnotationRoman(language = language, text = text, scheme = scheme)
}

/**
 * Creates a translation of a whole line.
 */
public fun makeEnrichedLineAnnotationTranslation(language: String? = null, text: String = ""): LineAnnotationTranslation {
    return LineAnnotationTranslation(language = language, text = text)
}

/**
 * Lowercases the romanization's language and scheme.
 */
public fun canonicalizeEnrichedLineAnnotationRoman(roman: LineAnnotationRoman): LineAnnotationRoman {
    return roman.copy(language = lowerTag(roman.language), scheme = lowerTag(roman.scheme))
}

/**
 * Lowercases the translation's language tag.
 */
public fun canonicalizeEnrichedLineAnnotationTranslation(translation: LineAnnotationTranslation): LineAnnotationTranslation {
    return translation.copy(language = lowerTag(translation.language))
}

/**
 * Canonicalizes line annotations and drops all-default entries.
 */
public fun canonicalizeEnrichedLineAnnotation(annotation: LineAnnotation): LineAnnotation {
    return annotation.copy(
        romans = canonicalizeList(annotation.romans, ::canonicalizeEnrichedLineAnnotationRoman),
        translations = canonicalizeList(annotation.translations, ::canonicalizeEnrichedLineAnnotationTranslation),
    )
}

private fun deriveWordRomans(words: List<Word>): List<LineAnnotationRoman> {
    val keys = words.flatMap { word -> word.annotation?.romans?.map { getAnnotationKey(it.language, it.scheme) } ?: emptyList() }.distinct()
    val romans = mutableListOf<LineAnnotationRoman>()
    for ((language, scheme) in keys) {
        val joined = StringBuilder()
        var spaced = false
        for (word in words) {
            if (word.type == WordType.WORD_TYPE_SPACE) {
                spaced = true
                continue
            }
            val roman = word.annotation?.romans?.firstOrNull { lowerTag(it.language) == language && lowerTag(it.scheme) == scheme }
            val text = roman?.let(::getEnrichedAnnotationItemText) ?: ""
            if (text.isNotEmpty()) {
                if (joined.isNotEmpty() && spaced) {
                    joined.append(' ')
                }
                joined.append(text)
                spaced = false
            }
        }
        if (joined.isNotEmpty()) {
            romans.add(makeEnrichedLineAnnotationRoman(language = language, text = joined.toString(), scheme = scheme))
        }
    }
    return romans
}

/**
 * Aggregates display-only romanizations by language and scheme in first-appearance order.
 *
 * Words without a matching romanization are skipped; separators collapse to one U+0020.
 * The returned annotations must not be stored on the line.
 */
public fun deriveEnrichedLineRomans(content: LineContent?): List<LineAnnotationRoman> {
    return deriveWordRomans(content?.words.orEmpty())
}

/**
 * Creates content from ordered words.
 */
public fun makeEnrichedLineContentWords(words: List<Word>): LineContent {
    return LineContent(words = words)
}

/**
 * Creates content from a whole line's text.
 */
public fun makeEnrichedLineContentText(text: String): LineContent {
    return LineContent(text = text)
}

/**
 * Canonicalizes words while preserving plain text.
 */
public fun canonicalizeEnrichedLineContent(content: LineContent): LineContent {
    return content.copy(words = canonicalizeList(content.words, ::canonicalizeEnrichedWord))
}

/**
 * Creates a normal line with a fixed LINE_TYPE_NORMAL discriminator.
 */
public fun makeEnrichedLineNormal(
    id: String = "",
    time: TimeRange? = null,
    part: Part? = null,
    agents: List<String> = emptyList(),
    languages: List<String> = emptyList(),
    content: LineContent? = null,
    annotation: LineAnnotation? = null,
    backgrounds: List<LineBackground> = emptyList(),
): Line {
    return Line(
        type = LineType.LINE_TYPE_NORMAL,
        id = id,
        time = time,
        part = part,
        agents = agents,
        languages = languages,
        content = content,
        annotation = annotation,
        backgrounds = backgrounds,
    )
}

/**
 * Creates an instrumental line containing only its time range and optional id and part.
 */
public fun makeEnrichedLineInstrumental(id: String = "", time: TimeRange? = null, part: Part? = null): Line {
    return Line(type = LineType.LINE_TYPE_INSTRUMENTAL, id = id, time = time, part = part)
}

/**
 * Creates a background vocal line.
 */
public fun makeEnrichedLineBackground(
    id: String = "",
    time: TimeRange? = null,
    agents: List<String> = emptyList(),
    languages: List<String> = emptyList(),
    content: LineContent? = null,
    annotation: LineAnnotation? = null,
): LineBackground {
    return LineBackground(id = id, time = time, agents = agents, languages = languages, content = content, annotation = annotation)
}

/**
 * Checks the line kind, permitted fields, timing, annotations, and backgrounds.
 *
 * An unresolved kind may omit content; TIMING_NONE reports instrumental lines through validateEnrichedLyric.
 */
public fun validateEnrichedLine(line: Line, path: String = "", timing: Timing = Timing.TIMING_UNSPECIFIED): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val instrumental = line.type == LineType.LINE_TYPE_INSTRUMENTAL
    // Forbidden fields are not traversed for nested diagnostics.
    if (!instrumental) {
        diagnostics += validateLineTags(line, path)
    }
    if (isUnresolved(line.type)) {
        diagnostics += Diagnostic(childPath(path, "type"), DiagnosticCode.LineTypeUnspecified)
    }
    val time = line.time
    // Untimed instrumental lines are reported by validateEnrichedLyric instead.
    val needsRange = instrumental && timing != Timing.TIMING_NONE
    if (time != null) {
        diagnostics += validateTimeRange(time, childPath(path, "time"))
        if (needsRange && time.end == null) {
            diagnostics += Diagnostic(childPath(path, "time.end"), DiagnosticCode.LineTimeEndMissing)
        }
        // Avoid secondary diagnostics for an invalid range.
        if (needsRange && isTimeRangeOrdered(time) && time.end != null && time.end == time.start) {
            diagnostics += Diagnostic(childPath(path, "time"), DiagnosticCode.LineTimeEmpty)
        }
    } else if (needsRange) {
        diagnostics += Diagnostic(childPath(path, "time"), DiagnosticCode.LineTimeMissing)
    }
    if (line.part != null) {
        diagnostics += validatePart(line.part, childPath(path, "part"))
    }
    if (instrumental && line.agents.size > 0) {
        diagnostics += Diagnostic(childPath(path, "agents"), DiagnosticCode.LineAgentsUnexpected)
    }
    if (instrumental && line.languages.size > 0) {
        diagnostics += Diagnostic(childPath(path, "languages"), DiagnosticCode.LineLanguagesUnexpected)
    } else if (!instrumental) {
        for (index in findDuplicates(line.languages) { lowerTag(it) ?: "" }) {
            diagnostics += Diagnostic(childPath(path, "languages[$index]"), DiagnosticCode.LineLanguagesDuplicate)
        }
    }
    // Unresolved kinds allow missing content while still validating supplied content.
    if (instrumental) {
        if (line.content != null) {
            diagnostics += Diagnostic(childPath(path, "content"), DiagnosticCode.LineContentUnexpected)
        }
    } else {
        diagnostics += validateEnrichedLineContent(line.content, time, path, timing, line.type == LineType.LINE_TYPE_NORMAL)
    }
    if (instrumental && line.annotation != null) {
        diagnostics += Diagnostic(childPath(path, "annotation"), DiagnosticCode.LineAnnotationUnexpected)
    } else if (line.annotation != null) {
        diagnostics += validateEnrichedLineAnnotation(line.annotation, childPath(path, "annotation"))
    }
    if (instrumental && line.backgrounds.size > 0) {
        diagnostics += Diagnostic(childPath(path, "backgrounds"), DiagnosticCode.LineBackgroundsUnexpected)
    } else {
        for (index in findUnordered(line.backgrounds) { it.time }) {
            diagnostics += Diagnostic(childPath(path, "backgrounds[$index]"), DiagnosticCode.LineBackgroundsUnordered)
        }
        line.backgrounds.forEachIndexed { index, background ->
            val backgroundPath = childPath(path, "backgrounds[$index]")
            val backgroundTime = background.time
            // Backgrounds may start earlier than their parent but must end within it.
            if (isTimeRangeOrdered(time) && isTimeRangeOrdered(backgroundTime) && getTimeRangeEnd(backgroundTime) > getTimeRangeEnd(time)) {
                diagnostics += Diagnostic(childPath(backgroundPath, "time"), DiagnosticCode.LineBackgroundsTimeUncovered)
            }
            diagnostics += validateEnrichedLineBackground(background, backgroundPath, timing)
        }
    }
    return diagnostics
}

/**
 * Checks required content, timing, languages, and annotations of background vocals.
 */
public fun validateEnrichedLineBackground(
    background: LineBackground,
    path: String = "",
    timing: Timing = Timing.TIMING_UNSPECIFIED,
): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val time = background.time
    if (time != null) {
        diagnostics += validateTimeRange(time, childPath(path, "time"))
    }
    for (index in findDuplicates(background.languages) { lowerTag(it) ?: "" }) {
        diagnostics += Diagnostic(childPath(path, "languages[$index]"), DiagnosticCode.LineLanguagesDuplicate)
    }
    diagnostics += validateEnrichedLineContent(background.content, time, path, timing)
    if (background.annotation != null) {
        diagnostics += validateEnrichedLineAnnotation(background.annotation, childPath(path, "annotation"))
    }
    return diagnostics
}

/**
 * Orders background vocals by start time.
 */
public fun orderEnrichedLine(line: Line): Line {
    return line.copy(backgrounds = line.backgrounds.sortedWith(byTime { it.time }))
}

/**
 * Normalizes language tags, removes empty references, and canonicalizes content and annotations.
 */
public fun canonicalizeEnrichedLineBackground(background: LineBackground): LineBackground {
    return background.copy(
        agents = background.agents.filter { it.isNotEmpty() },
        languages = background.languages.mapNotNull(::lowerTag).distinct(),
        content = canonicalizeField(background.content, ::canonicalizeEnrichedLineContent),
        annotation = canonicalizeField(background.annotation, ::canonicalizeEnrichedLineAnnotation),
    )
}

/**
 * Normalizes tags and references, canonicalizes nested content, and orders backgrounds.
 */
public fun canonicalizeEnrichedLine(line: Line): Line {
    return line.copy(
        part = dropDefault(line.part),
        agents = line.agents.filter { it.isNotEmpty() },
        languages = line.languages.mapNotNull(::lowerTag).distinct(),
        content = canonicalizeField(line.content, ::canonicalizeEnrichedLineContent),
        annotation = canonicalizeField(line.annotation, ::canonicalizeEnrichedLineAnnotation),
        backgrounds = canonicalizeList(line.backgrounds, ::canonicalizeEnrichedLineBackground).sortedWith(byTime { it.time }),
    )
}

/**
 * Resolves agent ids in order, ignoring empty or unknown ids and keeping the first agent for duplicate ids.
 */
fun resolveEnrichedLineAgents(line: Line, agents: List<Agent>): List<Agent> {
    return resolveAgents(line.agents, agents)
}

/**
 * Resolves agent ids in order, ignoring empty or unknown ids and keeping the first agent for duplicate ids.
 */
fun resolveEnrichedLineAgents(line: LineBackground, agents: List<Agent>): List<Agent> {
    return resolveAgents(line.agents, agents)
}
