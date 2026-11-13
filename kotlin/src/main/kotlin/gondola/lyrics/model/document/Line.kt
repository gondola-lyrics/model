@file:JvmName("LineHelper")

package gondola.lyrics.model.document

import gondola.lyrics.model.common.Agent
import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.Part
import gondola.lyrics.model.common.PartType
import gondola.lyrics.model.common.TextToken
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.common.canonicalizeTextToken
import gondola.lyrics.model.common.resolveAgents
import gondola.lyrics.model.common.validateLanguageTag
import gondola.lyrics.model.common.validateLanguageTags
import gondola.lyrics.model.common.validatePart
import gondola.lyrics.model.common.validateTextToken
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.utils.byTime
import gondola.lyrics.model.utils.canonicalizeField
import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.dropDefault
import gondola.lyrics.model.utils.findDefaultEntries
import gondola.lyrics.model.utils.findDuplicates
import gondola.lyrics.model.utils.findUnordered
import gondola.lyrics.model.utils.getAnnotationKey
import gondola.lyrics.model.utils.getTimeRangeEnd
import gondola.lyrics.model.utils.isTimeRangeOrdered
import gondola.lyrics.model.utils.isTimeRangeUncovered
import gondola.lyrics.model.utils.isUnresolved
import gondola.lyrics.model.utils.lowerTag

private fun validateContentFields(hasWords: Boolean, text: String?, path: String, required: Boolean): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (required && !hasWords && text == null) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.LineContentMissing))
    } else if (hasWords && text != null) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.LineContentAmbiguous))
    }
    // Empty text still counts as present for exclusivity.
    if (text == "") {
        diagnostics.add(Diagnostic(childPath(path, "text"), DiagnosticCode.LineContentTextEmpty))
    }
    return diagnostics
}

/**
 * Checks that exactly one non-empty content form is present and validates its words.
 *
 * Paths are relative to the content; NONE and LINE require whole-line text.
 * An unresolved line kind may omit content when required is false.
 */
public fun validateDocumentLineContent(
    content: LineContent?,
    time: TimeRange?,
    path: String = "",
    timing: TimingLevel = TimingLevel.TIMING_LEVEL_UNSPECIFIED,
    required: Boolean = true,
): List<Diagnostic> {
    val diagnostics = validateContentFields(!content?.words.isNullOrEmpty(), content?.text, path, required).toMutableList()
    if (!content?.words.isNullOrEmpty()) {
        if (timing == TimingLevel.TIMING_LEVEL_NONE) {
            diagnostics.add(Diagnostic(childPath(path, "words"), DiagnosticCode.LyricTimingNoneWords))
        } else if (timing == TimingLevel.TIMING_LEVEL_LINE) {
            diagnostics.add(Diagnostic(childPath(path, "words"), DiagnosticCode.LyricTimingLineWords))
        }
    }
    diagnostics.addAll(validateDocumentWords(content?.words.orEmpty(), time, childPath(path, "words"), timing))
    return diagnostics
}

/**
 * Returns plain text when present, otherwise joins the content's words.
 */
public fun getDocumentLineContentText(content: LineContent?): String {
    return content?.text ?: getDocumentWordsText(content?.words.orEmpty())
}

/**
 * Reports whether the line contains words.
 */
public fun isDocumentWordLevelLine(line: Line): Boolean {
    return !line.content?.words.isNullOrEmpty()
}

/**
 * Reports whether the line contains words.
 */
public fun isDocumentWordLevelLine(line: LineBackground): Boolean {
    return !line.content?.words.isNullOrEmpty()
}

/**
 * Returns distinct lowercase line languages, using normal-word languages when the line declares none.
 */
public fun deriveDocumentLineLanguages(line: Line): List<String> {
    return if (line.languages.isEmpty()) {
        getDocumentWordsLanguages(
            line.content?.words.orEmpty(),
        )
    } else {
        line.languages.mapNotNull(::lowerTag).distinct()
    }
}

/**
 * Returns distinct lowercase line languages, using normal-word languages when the line declares none.
 */
public fun deriveDocumentLineLanguages(line: LineBackground): List<String> {
    return if (line.languages.isEmpty()) {
        getDocumentWordsLanguages(
            line.content?.words.orEmpty(),
        )
    } else {
        line.languages.mapNotNull(::lowerTag).distinct()
    }
}

/**
 * Creates annotations explicitly attached to a whole line.
 */
public fun makeDocumentLineAnnotation(
    romans: List<LineAnnotationRoman> = emptyList(),
    translations: List<LineAnnotationTranslation> = emptyList(),
): LineAnnotation {
    return LineAnnotation(romans = romans, translations = translations)
}

/**
 * Creates roman content from source fragments without adding whole-line text.
 */
public fun makeDocumentLineAnnotationRomanContentTokens(tokens: List<TextToken>): LineAnnotationRomanContent {
    return LineAnnotationRomanContent(tokens = tokens)
}

/**
 * Creates whole-line roman text without fragment timing.
 */
public fun makeDocumentLineAnnotationRomanContentText(text: String): LineAnnotationRomanContent {
    return LineAnnotationRomanContent(text = text)
}

/**
 * Checks exclusive content, non-empty text, a token timing anchor, and containment in a declared annotation range.
 *
 * Explicit token times are independent of the original line when the annotation has no declared range.
 */
public fun validateDocumentLineAnnotationRomanContent(
    content: LineAnnotationRomanContent?,
    path: String = "",
    time: TimeRange? = null,
): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val tokens = content?.tokens.orEmpty()
    val hasTokens = tokens.isNotEmpty()
    val hasText = content?.text != null
    if (!hasTokens && !hasText) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.LineAnnotationRomanContentMissing))
    } else if (hasTokens && hasText) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.LineAnnotationRomanContentAmbiguous))
    }
    if (content?.text == "") {
        diagnostics.add(Diagnostic(childPath(path, "text"), DiagnosticCode.LineAnnotationRomanContentTextEmpty))
    }
    if (hasTokens && tokens.none { it.time != null }) {
        diagnostics.add(Diagnostic(childPath(path, "tokens"), DiagnosticCode.LineAnnotationRomanContentTokensTimeMissing))
    }
    tokens.forEachIndexed { index, token ->
        val tokenPath = childPath(path, "tokens[$index]")
        if (token.text.isEmpty()) {
            diagnostics.add(Diagnostic(childPath(tokenPath, "text"), DiagnosticCode.LineAnnotationRomanTokenTextEmpty))
        }
        diagnostics.addAll(validateTextToken(token, tokenPath))
        if (isTimeRangeUncovered(token.time, time)) {
            diagnostics.add(Diagnostic(childPath(tokenPath, "time"), DiagnosticCode.LineAnnotationRomanTimeUncovered))
        }
    }
    return diagnostics
}

/**
 * Checks the language, declared range, and required roman content independently of the original line.
 *
 * Paths are relative to the romanization unless its location is supplied.
 */
public fun validateDocumentLineAnnotationRoman(roman: LineAnnotationRoman, path: String = ""): List<Diagnostic> {
    val diagnostics = validateDocumentLineAnnotationRomanContent(roman.content, childPath(path, "content"), roman.time).toMutableList()
    diagnostics.addAll(validateLanguageTag(roman.language, childPath(path, "language")))
    if (roman.time != null) {
        diagnostics.addAll(validateTimeRange(roman.time, childPath(path, "time")))
    }
    return diagnostics
}

/**
 * Checks annotation languages, repeated entries, roman content, and variant uniqueness.
 *
 * Paths are relative to the annotation unless its location is supplied.
 */
public fun validateDocumentLineAnnotation(annotation: LineAnnotation, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    findDuplicates(annotation.romans) { getAnnotationKey(it.language, it.scheme) }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "romans[$index]"), DiagnosticCode.LineAnnotationRomansDuplicate))
    }
    findDuplicates(annotation.translations) { lowerTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "translations[$index]"), DiagnosticCode.LineAnnotationTranslationsLanguageDuplicate))
    }
    annotation.romans.forEachIndexed { index, roman ->
        diagnostics.addAll(validateDocumentLineAnnotationRoman(roman, childPath(path, "romans[$index]")))
    }
    annotation.translations.forEachIndexed { index, translation ->
        diagnostics.addAll(validateLanguageTag(translation.language, childPath(path, "translations[$index].language")))
    }
    findDefaultEntries(annotation, diagnostics.map { it.path }, path).forEach { entryPath ->
        diagnostics.add(Diagnostic(entryPath, DiagnosticCode.LyricListEntryEmpty))
    }
    return diagnostics
}

private fun validateRomanPlacement(annotation: LineAnnotation, content: LineContent?, path: String): List<Diagnostic> {
    val wordKeys = mutableSetOf<Pair<String?, String?>>()
    for (word in content?.words.orEmpty()) {
        if (word.type == WordType.WORD_TYPE_SPACE) {
            continue
        }
        for (roman in word.annotation?.romans.orEmpty()) {
            wordKeys.add(getAnnotationKey(roman.language, roman.scheme))
        }
    }
    val diagnostics = mutableListOf<Diagnostic>()
    annotation.romans.forEachIndexed { index, roman ->
        if (getAnnotationKey(roman.language, roman.scheme) in wordKeys) {
            diagnostics.add(Diagnostic(childPath(path, "romans[$index]"), DiagnosticCode.LineAnnotationRomansConflict))
        }
    }
    return diagnostics
}

/**
 * Creates a whole-line romanization without normalizing its language or scheme.
 */
public fun makeDocumentLineAnnotationRoman(
    language: String? = null,
    scheme: String? = null,
    time: TimeRange? = null,
    content: LineAnnotationRomanContent? = null,
): LineAnnotationRoman {
    return LineAnnotationRoman(language = language, scheme = scheme, time = time, content = content)
}

/**
 * Creates a translation of a whole line.
 */
public fun makeDocumentLineAnnotationTranslation(language: String? = null, text: String = ""): LineAnnotationTranslation {
    return LineAnnotationTranslation(language = language, text = text)
}

/**
 * Copies roman content, preserving fragment order, whitespace, and explicit timing.
 */
public fun canonicalizeDocumentLineAnnotationRomanContent(content: LineAnnotationRomanContent): LineAnnotationRomanContent {
    return content.copy(tokens = canonicalizeList(content.tokens, ::canonicalizeTextToken))
}

/**
 * Lowercases language and scheme and copies roman content and timing without inferring missing boundaries.
 */
public fun canonicalizeDocumentLineAnnotationRoman(roman: LineAnnotationRoman): LineAnnotationRoman {
    return roman.copy(
        language = lowerTag(roman.language),
        scheme = lowerTag(roman.scheme),
        time = roman.time?.copy(),
        content = canonicalizeField(roman.content, ::canonicalizeDocumentLineAnnotationRomanContent),
    )
}

/**
 * Returns whole-line text or joins source fragments without adding separators.
 */
public fun getDocumentLineAnnotationRomanText(roman: LineAnnotationRoman): String {
    return roman.content?.text ?: roman.content?.tokens.orEmpty().joinToString("") { it.text }
}

/**
 * Uses the romanization's declared time, falling back to the owning line.
 */
public fun resolveDocumentLineAnnotationRomanTime(roman: LineAnnotationRoman, line: Line): TimeRange? {
    return roman.time ?: line.time
}

/**
 * Uses the romanization's declared time, falling back to the owning background.
 */
public fun resolveDocumentLineAnnotationRomanTime(roman: LineAnnotationRoman, line: LineBackground): TimeRange? {
    return roman.time ?: line.time
}

/**
 * Uses the entire token time, then the romanization's time, then the owning line's time.
 */
public fun resolveDocumentLineAnnotationRomanTokenTime(token: TextToken, roman: LineAnnotationRoman, line: Line): TimeRange? {
    return token.time ?: resolveDocumentLineAnnotationRomanTime(roman, line)
}

/**
 * Uses the entire token time, then the romanization's time, then the owning background's time.
 */
public fun resolveDocumentLineAnnotationRomanTokenTime(token: TextToken, roman: LineAnnotationRoman, line: LineBackground): TimeRange? {
    return token.time ?: resolveDocumentLineAnnotationRomanTime(roman, line)
}

/**
 * Lowercases the translation's language tag.
 */
public fun canonicalizeDocumentLineAnnotationTranslation(translation: LineAnnotationTranslation): LineAnnotationTranslation {
    return translation.copy(language = lowerTag(translation.language))
}

/**
 * Canonicalizes line annotations and drops all-default entries.
 */
public fun canonicalizeDocumentLineAnnotation(annotation: LineAnnotation): LineAnnotation {
    return annotation.copy(
        romans = canonicalizeList(annotation.romans, ::canonicalizeDocumentLineAnnotationRoman),
        translations = canonicalizeList(annotation.translations, ::canonicalizeDocumentLineAnnotationTranslation),
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
            val text = roman?.let(::getDocumentAnnotationItemText) ?: ""
            if (text.isNotEmpty()) {
                if (joined.isNotEmpty() && spaced) {
                    joined.append(' ')
                }
                joined.append(text)
                spaced = false
            }
        }
        if (joined.isNotEmpty()) {
            romans.add(
                makeDocumentLineAnnotationRoman(
                    language = language,
                    scheme = scheme,
                    content = makeDocumentLineAnnotationRomanContentText(joined.toString()),
                ),
            )
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
public fun deriveDocumentLineRomans(content: LineContent?): List<LineAnnotationRoman> {
    return deriveWordRomans(content?.words.orEmpty())
}

/**
 * Creates content from ordered words.
 */
public fun makeDocumentLineContentWords(words: List<Word>): LineContent {
    return LineContent(words = words)
}

/**
 * Creates content from a whole line's text.
 */
public fun makeDocumentLineContentText(text: String): LineContent {
    return LineContent(text = text)
}

/**
 * Canonicalizes words while preserving plain text.
 */
public fun canonicalizeDocumentLineContent(content: LineContent): LineContent {
    return content.copy(words = canonicalizeList(content.words, ::canonicalizeDocumentWord))
}

/**
 * Creates a normal line with a fixed LINE_TYPE_NORMAL discriminator.
 */
public fun makeDocumentLineNormal(
    id: String = "",
    time: TimeRange? = null,
    part: Part? = null,
    agentIds: List<String> = emptyList(),
    languages: List<String> = emptyList(),
    backgrounds: List<LineBackground> = emptyList(),
    content: LineContent? = null,
    annotation: LineAnnotation? = null,
): Line {
    return Line(
        type = LineType.LINE_TYPE_NORMAL,
        id = id,
        time = time,
        part = part,
        agentIds = agentIds,
        languages = languages,
        backgrounds = backgrounds,
        content = content,
        annotation = annotation,
    )
}

/**
 * Creates an instrumental line containing only its time range and optional id and part.
 */
public fun makeDocumentLineInstrumental(id: String = "", time: TimeRange? = null, part: Part? = null): Line {
    return Line(type = LineType.LINE_TYPE_INSTRUMENTAL, id = id, time = time, part = part)
}

/**
 * Creates a background vocal line.
 */
public fun makeDocumentLineBackground(
    id: String = "",
    time: TimeRange? = null,
    agentIds: List<String> = emptyList(),
    languages: List<String> = emptyList(),
    content: LineContent? = null,
    annotation: LineAnnotation? = null,
): LineBackground {
    return LineBackground(id = id, time = time, agentIds = agentIds, languages = languages, content = content, annotation = annotation)
}

/**
 * Checks the line kind, permitted fields, timing, annotations, and backgrounds.
 *
 * Paths are relative to the line; the supplied timing level controls original content and time requirements.
 * An unresolved kind may omit content; whether a sung line must have an end depends on its lyric position.
 */
public fun validateDocumentLine(line: Line, path: String = "", timing: TimingLevel = TimingLevel.TIMING_LEVEL_UNSPECIFIED): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val instrumental = line.type == LineType.LINE_TYPE_INSTRUMENTAL
    if (isUnresolved(line.type)) {
        diagnostics += Diagnostic(childPath(path, "type"), DiagnosticCode.LineTypeUnspecified)
    }
    val time = line.time
    val needsRange = instrumental && timing != TimingLevel.TIMING_LEVEL_NONE
    if (instrumental && timing == TimingLevel.TIMING_LEVEL_NONE) {
        diagnostics += Diagnostic(childPath(path, "type"), DiagnosticCode.LyricTimingNoneInstrumental)
    }
    if (time != null) {
        if (timing == TimingLevel.TIMING_LEVEL_NONE) {
            diagnostics += Diagnostic(childPath(path, "time"), DiagnosticCode.LyricTimingNonePresent)
        }
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
    } else if (line.type == LineType.LINE_TYPE_NORMAL &&
        (timing == TimingLevel.TIMING_LEVEL_LINE || timing == TimingLevel.TIMING_LEVEL_WORD)
    ) {
        diagnostics += Diagnostic(childPath(path, "time"), DiagnosticCode.LyricTimingLineTimeMissing)
    }
    if (line.part != null) {
        diagnostics += validatePart(line.part, childPath(path, "part"))
        if (line.part.type == PartType.PART_TYPE_INTERLUDE && line.type == LineType.LINE_TYPE_NORMAL) {
            diagnostics += Diagnostic(childPath(path, "part.type"), DiagnosticCode.LinePartInterludeNotInstrumental)
        }
    }
    if (instrumental && line.agentIds.size > 0) {
        diagnostics += Diagnostic(childPath(path, "agentIds"), DiagnosticCode.LineAgentIdsUnexpected)
    } else if (!instrumental) {
        line.agentIds.forEachIndexed { index, id ->
            if (id.isEmpty()) {
                diagnostics += Diagnostic(childPath(path, "agentIds[$index]"), DiagnosticCode.LyricListEntryEmpty)
            }
        }
    }
    if (instrumental && line.languages.size > 0) {
        diagnostics += Diagnostic(childPath(path, "languages"), DiagnosticCode.LineLanguagesUnexpected)
    } else if (!instrumental) {
        diagnostics += validateLanguageTags(line.languages, childPath(path, "languages"))
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
        diagnostics += validateDocumentLineContent(line.content, time, childPath(path, "content"), timing, line.type == LineType.LINE_TYPE_NORMAL)
    }
    if (instrumental && line.annotation != null) {
        diagnostics += Diagnostic(childPath(path, "annotation"), DiagnosticCode.LineAnnotationUnexpected)
    } else if (line.annotation != null) {
        diagnostics += validateDocumentLineAnnotation(line.annotation, childPath(path, "annotation"))
        diagnostics += validateRomanPlacement(line.annotation, line.content, childPath(path, "annotation"))
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
            diagnostics += validateDocumentLineBackground(background, backgroundPath, timing)
        }
    }
    return diagnostics
}

/**
 * Checks background content, languages, reference strings, annotations, and declared timing requirements.
 *
 * Paths are relative to the background; parent containment and global reference resolution need a containing line or lyric.
 */
public fun validateDocumentLineBackground(
    background: LineBackground,
    path: String = "",
    timing: TimingLevel = TimingLevel.TIMING_LEVEL_UNSPECIFIED,
): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val time = background.time
    if (time != null) {
        if (timing == TimingLevel.TIMING_LEVEL_NONE) {
            diagnostics += Diagnostic(childPath(path, "time"), DiagnosticCode.LyricTimingNonePresent)
        }
        diagnostics += validateTimeRange(time, childPath(path, "time"))
    } else if (timing == TimingLevel.TIMING_LEVEL_LINE || timing == TimingLevel.TIMING_LEVEL_WORD) {
        diagnostics += Diagnostic(childPath(path, "time"), DiagnosticCode.LyricTimingLineTimeMissing)
    }
    background.agentIds.forEachIndexed { index, id ->
        if (id.isEmpty()) {
            diagnostics += Diagnostic(childPath(path, "agentIds[$index]"), DiagnosticCode.LyricListEntryEmpty)
        }
    }
    diagnostics += validateLanguageTags(background.languages, childPath(path, "languages"))
    for (index in findDuplicates(background.languages) { lowerTag(it) ?: "" }) {
        diagnostics += Diagnostic(childPath(path, "languages[$index]"), DiagnosticCode.LineLanguagesDuplicate)
    }
    diagnostics += validateDocumentLineContent(background.content, time, childPath(path, "content"), timing)
    if (background.annotation != null) {
        diagnostics += validateDocumentLineAnnotation(background.annotation, childPath(path, "annotation"))
        diagnostics += validateRomanPlacement(background.annotation, background.content, childPath(path, "annotation"))
    }
    return diagnostics
}

/**
 * Returns a copy with backgrounds stably ordered by start time.
 */
public fun orderDocumentLine(line: Line): Line {
    return line.copy(backgrounds = line.backgrounds.sortedWith(byTime { it.time }))
}

/**
 * Normalizes language tags, removes empty references, and canonicalizes content and annotations.
 */
public fun canonicalizeDocumentLineBackground(background: LineBackground): LineBackground {
    return background.copy(
        agentIds = background.agentIds.filter { it.isNotEmpty() },
        languages = background.languages.mapNotNull(::lowerTag).distinct(),
        content = canonicalizeField(background.content, ::canonicalizeDocumentLineContent),
        annotation = canonicalizeField(background.annotation, ::canonicalizeDocumentLineAnnotation),
    )
}

/**
 * Normalizes tags and references, canonicalizes nested content, and orders backgrounds.
 */
public fun canonicalizeDocumentLine(line: Line): Line {
    return line.copy(
        part = dropDefault(line.part),
        agentIds = line.agentIds.filter { it.isNotEmpty() },
        languages = line.languages.mapNotNull(::lowerTag).distinct(),
        backgrounds = canonicalizeList(line.backgrounds, ::canonicalizeDocumentLineBackground).sortedWith(byTime { it.time }),
        content = canonicalizeField(line.content, ::canonicalizeDocumentLineContent),
        annotation = canonicalizeField(line.annotation, ::canonicalizeDocumentLineAnnotation),
    )
}

/**
 * Resolves `agentIds` in order, ignoring empty or unknown ids and keeping the first agent for duplicate ids.
 */
fun resolveDocumentLineAgents(line: Line, agents: List<Agent>): List<Agent> {
    return resolveAgents(line.agentIds, agents)
}

/**
 * Resolves `agentIds` in order, ignoring empty or unknown ids and keeping the first agent for duplicate ids.
 */
fun resolveDocumentLineAgents(line: LineBackground, agents: List<Agent>): List<Agent> {
    return resolveAgents(line.agentIds, agents)
}
