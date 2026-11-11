@file:JvmName("LyricHelper")

package gondola.lyrics.model.storage

import gondola.lyrics.model.SCHEMA_VERSION
import gondola.lyrics.model.common.Agent
import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.LineType
import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.canonicalizeAgent
import gondola.lyrics.model.common.canonicalizeMeta
import gondola.lyrics.model.common.validateAgent
import gondola.lyrics.model.common.validateLyricParts
import gondola.lyrics.model.common.validateLyricTags
import gondola.lyrics.model.common.validateMeta
import gondola.lyrics.model.utils.SEMVER_PATTERN
import gondola.lyrics.model.utils.byTime
import gondola.lyrics.model.utils.canonicalizeField
import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.decodeStorageLyric
import gondola.lyrics.model.utils.encodeStorageLyric
import gondola.lyrics.model.utils.findDefaultEntries
import gondola.lyrics.model.utils.findUnordered
import gondola.lyrics.model.utils.isUnresolved
import gondola.lyrics.model.utils.read
import gondola.lyrics.model.utils.write

/**
 * Creates a storage Lyric, stamping the current schema version.
 */
public fun makeLyric(
    format: String = "",
    profile: String = "",
    timing: Timing = Timing.TIMING_UNSPECIFIED,
    meta: Meta? = null,
    extra: Map<String, String> = emptyMap(),
    agents: List<Agent> = emptyList(),
    lines: List<Line> = emptyList(),
): Lyric {
    return Lyric(
        version = SCHEMA_VERSION,
        format = format,
        profile = profile,
        timing = timing,
        meta = meta,
        extra = extra,
        agents = agents,
        lines = lines,
    )
}

/**
 * Validates a storage Lyric: the rules needing the whole tree in view, then recursing into agents, credits and lines.
 */
public fun validateLyric(lyric: Lyric): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (!SEMVER_PATTERN.matches(lyric.version)) {
        diagnostics += Diagnostic("version", DiagnosticCode.LyricVersionMalformed)
    }

    // An unresolved precision leaves every timing rule with nothing to hold the lyric to, so a lyric that never stated one is reported rather than read as untimed.
    if (isUnresolved(lyric.timing)) {
        diagnostics += Diagnostic("timing", DiagnosticCode.LyricTimingUnspecified)
    }
    val ids = mutableSetOf<String>()
    lyric.agents.forEachIndexed { index, agent ->
        if (agent.id in ids) {
            diagnostics += Diagnostic("agents[$index]", DiagnosticCode.LyricAgentIdDuplicate)
        }
        // An empty id is reported by validateAgent and never resolves a reference.
        if (agent.id.isNotEmpty()) {
            ids += agent.id
        }
        diagnostics += validateAgent(agent, "agents[$index]")
    }
    if (lyric.meta != null) {
        diagnostics += validateMeta(lyric.meta, "meta")
    }
    // Every tag outside the lines is read here, since a line's own are read by validateLine, which knows the fields its kind forbids.
    diagnostics += validateLyricTags(lyric)

    val untimed = lyric.timing == Timing.TIMING_NONE
    val lineTimed = lyric.timing == Timing.TIMING_LINE
    val timed = lineTimed || lyric.timing == Timing.TIMING_WORD
    var anyContent = false
    var anyWords = false
    val lineIds = mutableSetOf<String>()

    /**
     * Reports a non-empty line id already taken by an earlier line or background line.
     */
    fun claimLineId(id: String, path: String) {
        if (id.isEmpty()) {
            return
        }
        if (!lineIds.add(id)) {
            diagnostics += Diagnostic(path, DiagnosticCode.LyricLineIdDuplicate)
        }
    }

    /**
     * Reports the whole-tree rules for one line or background line: agent references resolving to no agent, and whatever the declared timing asks of it.
     * It walks every node whatever the line's kind, since a whole-tree invariant holds regardless; an instrumental line's agents and own range validateLine already rules on, and a background line is read as the sung line it always is.
     * `forbidden` marks a node its parent's kind does not allow at all: what it carries is still held to the rules it breaks by carrying it, but nothing further is asked of it, since the node as a whole is already reported.
     * `open` marks a node whose range may stay open above: the last line, which nothing in the lyric bounds, and every background line, which the line it attaches to already bounds.
     */
    fun checkReferences(
        agents: List<String>,
        time: TimeRange?,
        content: LineContent?,
        path: String,
        type: LineType = LineType.LINE_TYPE_NORMAL,
        forbidden: Boolean = false,
        open: Boolean = false,
    ) {
        val words = content?.words.orEmpty()
        // A kind outside the enum turns out to need no range as readily as the zero value, so both are left unasked.
        val unresolvedType = isUnresolved(type)
        if (type != LineType.LINE_TYPE_INSTRUMENTAL) {
            agents.forEachIndexed { index, id ->
                if (id !in ids) {
                    diagnostics += Diagnostic("$path.agents[$index]", DiagnosticCode.LyricLineAgentDangling)
                }
            }
            anyWords = anyWords || words.isNotEmpty()
            anyContent = anyContent || words.isNotEmpty() || content?.text != null
            // Line-level timing sits on the line itself, so a sung line needs its own range and may not be split into words.
            if (lineTimed && words.isNotEmpty()) {
                diagnostics += Diagnostic("$path.content.words", DiagnosticCode.LyricTimingLineWords)
            }
            // Only a kind known to sing is asked for a range, since an unresolved one may turn out to need none, and a node that is not allowed in the first place is asked for nothing.
            if (timed && time == null && !unresolvedType && !forbidden) {
                diagnostics += Diagnostic(childPath(path, "time"), DiagnosticCode.LyricTimingLineTimeMissing)
            }
            // A sung line is shown for as long as its range runs, so the range has to end somewhere.
            if (timed && time != null && time.end == null && !unresolvedType && !forbidden && !open) {
                diagnostics += Diagnostic(childPath(path, "time.end"), DiagnosticCode.LyricLineTimeEndMissing)
            }
        } else if (untimed) {
            // An untimed lyric marks out no stretches, so it carries no instrumental line at all.
            diagnostics += Diagnostic(childPath(path, "type"), DiagnosticCode.LyricTimingNoneInstrumental)
        }
        if (untimed && time != null) {
            diagnostics += Diagnostic(childPath(path, "time"), DiagnosticCode.LyricTimingNonePresent)
        }
        if (untimed && words.isNotEmpty()) {
            diagnostics += Diagnostic("$path.content.words", DiagnosticCode.LyricTimingNoneWords)
        }
        if (untimed) {
            words.forEachIndexed { index, word ->
                if (word.time != null) {
                    diagnostics += Diagnostic("$path.content.words[$index].time", DiagnosticCode.LyricTimingNonePresent)
                }
            }
        }
    }

    lyric.lines.forEachIndexed { index, line ->
        val path = "lines[$index]"
        val forbidden = line.type == LineType.LINE_TYPE_INSTRUMENTAL
        claimLineId(line.id, path)
        checkReferences(
            line.agents,
            line.time,
            line.content,
            path,
            line.type,
            open = index == lyric.lines.size - 1,
        )
        line.backgrounds.forEachIndexed { backgroundIndex, background ->
            val backgroundPath = "$path.backgrounds[$backgroundIndex]"
            claimLineId(background.id, backgroundPath)
            checkReferences(
                background.agents,
                background.time,
                background.content,
                backgroundPath,
                forbidden = forbidden,
                open = true,
            )
        }
        diagnostics += validateLine(line, path, lyric.timing)
    }
    // Word-level timing needs only one line split into words, since a word-level source may leave the rest whole; a lyric with no content at all declares nothing to check.
    if (lyric.timing == Timing.TIMING_WORD && anyContent && !anyWords) {
        diagnostics += Diagnostic("timing", DiagnosticCode.LyricTimingWordMissing)
    }
    // The schema declares the list ordered, so a line starting before the one it follows is out of place.
    for (index in findUnordered(lyric.lines) { line -> line.time }) {
        diagnostics += Diagnostic("lines[$index]", DiagnosticCode.LyricLinesUnordered)
    }
    diagnostics += validateLyricParts(lyric.lines.map { it.part })
    // A rule that already spoke about a path keeps the sweep off it, and validateAgent reports an all-default agent at the agent rather than inside it.
    val covered = diagnostics.map { it.path } + lyric.agents.indices.map { "agents[$it]" }
    for (path in findDefaultEntries(lyric, covered)) {
        diagnostics += Diagnostic(path, DiagnosticCode.LyricListEntryEmpty)
    }
    return diagnostics
}

/**
 * Returns a copy of the lyric in canonical order: lines and their backgrounds by start time.
 */
public fun orderLyric(lyric: Lyric): Lyric {
    return lyric.copy(
        lines = lyric.lines.sortedWith(byTime { line -> line.time }).map(::orderLine),
    )
}

/**
 * Returns a canonical copy of the storage lyric: format and profile lowercased, meta/agents/lines canonicalized, lines ordered.
 * The copy shares no mutable containers with the lyric it was given, so editing either leaves the other as it was.
 */
public fun canonicalizeLyric(lyric: Lyric): Lyric {
    return lyric.copy(
        format = lyric.format.lowercase(),
        profile = lyric.profile.lowercase(),
        meta = canonicalizeField(lyric.meta, ::canonicalizeMeta),
        extra = lyric.extra.toMap(),
        agents = canonicalizeList(lyric.agents, ::canonicalizeAgent),
        lines = canonicalizeList(lyric.lines, ::canonicalizeLine).sortedWith(byTime { line -> line.time }),
    )
}

/**
 * Encodes a storage Lyric to bytes the official Protobuf libraries read.
 * It throws on a number its field cannot hold and on a string that is not well-formed UTF-16.
 */
public fun encode(lyric: Lyric): ByteArray {
    return write(::encodeStorageLyric, lyric)
}

/**
 * Decodes a storage Lyric from bytes, dropping fields the schema does not define.
 * It throws on malformed bytes and leaves the schema's rules to validateLyric.
 */
public fun decode(bytes: ByteArray): Lyric {
    return read(::decodeStorageLyric, bytes)
}
