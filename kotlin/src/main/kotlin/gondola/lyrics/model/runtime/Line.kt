@file:JvmName("LineHelper")

package gondola.lyrics.model.runtime

import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.LineAnnotation
import gondola.lyrics.model.common.LineType
import gondola.lyrics.model.common.Part
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.canonicalizeLineAnnotation
import gondola.lyrics.model.common.validateContent
import gondola.lyrics.model.common.validateLineAnnotation
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
import gondola.lyrics.model.utils.getTimeRangeEnd
import gondola.lyrics.model.utils.isTimeRangeOrdered
import gondola.lyrics.model.utils.isUnresolved
import gondola.lyrics.model.utils.lowerTag

/**
 * Creates a word-level LineContent from the words the line decomposes into.
 */
public fun makeLineContentWords(words: List<Word>): LineContent {
    return LineContent(words = words)
}

/**
 * Creates a line-level LineContent from the line's plain text.
 */
public fun makeLineContentText(text: String): LineContent {
    return LineContent(text = text)
}

/**
 * Returns a canonical copy of the content with its words canonicalized; the plain text is left as is.
 */
public fun canonicalizeLineContent(content: LineContent): LineContent {
    return content.copy(words = canonicalizeList(content.words, ::canonicalizeWord))
}

/**
 * Creates a normal line, stamping LINE_TYPE_NORMAL so the discriminant can never be set from outside.
 */
public fun makeLineNormal(
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
 * Creates an instrumental line, stamping LINE_TYPE_INSTRUMENTAL and carrying no content, only a time range and optionally an id and a part.
 * A present part means the source stated the stretch; its absence means it was derived from a gap in the timeline.
 */
public fun makeLineInstrumental(id: String = "", time: TimeRange? = null, part: Part? = null): Line {
    return Line(type = LineType.LINE_TYPE_INSTRUMENTAL, id = id, time = time, part = part)
}

/**
 * Creates a LineBackground, a background vocal line attached to a normal line.
 */
public fun makeLineBackground(
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
 * Validates a Line: its kind must be resolved, a NORMAL line must carry content, an INSTRUMENTAL one must carry only a range that ends somewhere, and its time, part, content and background lines must each be valid.
 * An unresolved kind is asked for no content and forbidden none, though whatever content it carries is still checked.
 * `timing` is the lyric's declared precision, passed down to its words; an untimed lyric asks an instrumental line for no range, since `validateLyric` reports the line itself instead.
 */
public fun validateLine(line: Line, path: String = "", timing: Timing = Timing.TIMING_UNSPECIFIED): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val instrumental = line.type == LineType.LINE_TYPE_INSTRUMENTAL
    // Tags are read here rather than by the lyric, since only this knows which fields a line's kind forbids, and a forbidden field is never descended into.
    if (!instrumental) {
        diagnostics += validateLineTags(line, path)
    }
    // A kind outside the enum reads as unresolved too, since a value this schema does not know cannot be held to any of its kind's rules.
    if (isUnresolved(line.type)) {
        diagnostics += Diagnostic(childPath(path, "type"), DiagnosticCode.LineTypeUnspecified)
    }
    val time = line.time
    // An instrumental line is the stretch its range marks out, so it is nothing without a range, and nothing with one that never ends or one that ends where it starts.
    // An untimed lyric marks out no stretches, so there the lyric reports the line itself and asks for no range here.
    val needsRange = instrumental && timing != Timing.TIMING_NONE
    if (time != null) {
        diagnostics += validateTimeRange(time, childPath(path, "time"))
        if (needsRange && time.end == null) {
            diagnostics += Diagnostic(childPath(path, "time.end"), DiagnosticCode.LineTimeEndMissing)
        }
        // Only a range running the right way makes its bounds worth comparing, so a range already reported for its own numbers is left alone here.
        if (needsRange && isTimeRangeOrdered(time) && time.end != null && time.end == time.start) {
            diagnostics += Diagnostic(childPath(path, "time"), DiagnosticCode.LineTimeEmpty)
        }
    } else if (needsRange) {
        diagnostics += Diagnostic(childPath(path, "time"), DiagnosticCode.LineTimeMissing)
    }
    if (line.part != null) {
        diagnostics += validatePart(line.part, childPath(path, "part"))
    }
    // An instrumental line carries no singing, so every field describing one is not allowed, and a forbidden field is never descended into.
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
    // Content belongs to a sung line, so an instrumental one may carry none, while an unresolved kind is asked for none and forbidden none.
    if (instrumental) {
        if (line.content != null) {
            diagnostics += Diagnostic(childPath(path, "content"), DiagnosticCode.LineContentUnexpected)
        }
    } else {
        diagnostics += validateContent(line.content, time, path, timing, line.type == LineType.LINE_TYPE_NORMAL)
    }
    if (instrumental && line.annotation != null) {
        diagnostics += Diagnostic(childPath(path, "annotation"), DiagnosticCode.LineAnnotationUnexpected)
    } else if (line.annotation != null) {
        diagnostics += validateLineAnnotation(line.annotation, childPath(path, "annotation"))
    }
    if (instrumental && line.backgrounds.size > 0) {
        diagnostics += Diagnostic(childPath(path, "backgrounds"), DiagnosticCode.LineBackgroundsUnexpected)
    } else {
        // The schema declares the list ordered, so an entry starting before the one it follows is out of place.
        for (index in findUnordered(line.backgrounds) { it.time }) {
            diagnostics += Diagnostic(childPath(path, "backgrounds[$index]"), DiagnosticCode.LineBackgroundsUnordered)
        }
        line.backgrounds.forEachIndexed { index, background ->
            val backgroundPath = childPath(path, "backgrounds[$index]")
            val backgroundTime = background.time
            // The parent's end covers a background line, while its start may precede the parent's; a range reported for its own numbers or order never joins this comparison.
            if (isTimeRangeOrdered(time) && isTimeRangeOrdered(backgroundTime) && getTimeRangeEnd(backgroundTime) > getTimeRangeEnd(time)) {
                diagnostics += Diagnostic(childPath(backgroundPath, "time"), DiagnosticCode.LineBackgroundsTimeUncovered)
            }
            diagnostics += validateLineBackground(background, backgroundPath, timing)
        }
    }
    return diagnostics
}

/**
 * Validates a LineBackground: it must carry content, and its time, content and annotation must each be valid.
 * `timing` is the lyric's declared precision, passed down to its words.
 */
public fun validateLineBackground(background: LineBackground, path: String = "", timing: Timing = Timing.TIMING_UNSPECIFIED): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val time = background.time
    if (time != null) {
        diagnostics += validateTimeRange(time, childPath(path, "time"))
    }
    for (index in findDuplicates(background.languages) { lowerTag(it) ?: "" }) {
        diagnostics += Diagnostic(childPath(path, "languages[$index]"), DiagnosticCode.LineLanguagesDuplicate)
    }
    diagnostics += validateContent(background.content, time, path, timing)
    if (background.annotation != null) {
        diagnostics += validateLineAnnotation(background.annotation, childPath(path, "annotation"))
    }
    return diagnostics
}

/**
 * Returns a copy of the line with its background lines ordered by start time ascending.
 */
public fun orderLine(line: Line): Line {
    return line.copy(backgrounds = line.backgrounds.sortedWith(byTime { it.time }))
}

/**
 * Returns a canonical copy of the background line: language tags lowercased, deduplicated and emptied out, content/annotation dropped when all-default, empty agent references dropped.
 */
public fun canonicalizeLineBackground(background: LineBackground): LineBackground {
    return background.copy(
        agents = background.agents.filter { it.isNotEmpty() },
        languages = background.languages.mapNotNull(::lowerTag).distinct(),
        content = canonicalizeField(background.content, ::canonicalizeLineContent),
        annotation = canonicalizeField(background.annotation, ::canonicalizeLineAnnotation),
    )
}

/**
 * Returns a canonical copy of the line: language tags lowercased, deduplicated and emptied out, part/content/annotation dropped when all-default, empty agent references dropped, backgrounds canonicalized then ordered.
 */
public fun canonicalizeLine(line: Line): Line {
    return line.copy(
        part = dropDefault(line.part),
        agents = line.agents.filter { it.isNotEmpty() },
        languages = line.languages.mapNotNull(::lowerTag).distinct(),
        content = canonicalizeField(line.content, ::canonicalizeLineContent),
        annotation = canonicalizeField(line.annotation, ::canonicalizeLineAnnotation),
        backgrounds = canonicalizeList(line.backgrounds, ::canonicalizeLineBackground).sortedWith(byTime { it.time }),
    )
}
