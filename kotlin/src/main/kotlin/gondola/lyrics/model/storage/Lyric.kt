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
import gondola.lyrics.model.common.validateLyricTags
import gondola.lyrics.model.common.validateMeta
import gondola.lyrics.model.utils.SEMVER_PATTERN
import gondola.lyrics.model.utils.byTime
import gondola.lyrics.model.utils.canonicalizeField
import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.findDefaultEntries
import gondola.lyrics.model.utils.findUnordered

/**
 * Creates a storage Lyric, stamping the current schema version on the immutable result.
 */
public fun makeLyric(
    format: String = "",
    timing: Timing = Timing.TIMING_UNSPECIFIED,
    meta: Meta? = null,
    extra: Map<String, String> = emptyMap(),
    agents: List<Agent> = emptyList(),
    lines: List<Line> = emptyList(),
): Lyric {
    val builder = Lyric.newBuilder().setVersion(SCHEMA_VERSION).setFormat(format).setTiming(timing)
        .putAllExtra(extra).addAllAgents(agents).addAllLines(lines)

    if (meta != null) {
        builder.meta = meta
    }
    return builder.build()
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
    if (lyric.timing == Timing.TIMING_UNSPECIFIED || lyric.timing == Timing.UNRECOGNIZED) {
        diagnostics += Diagnostic("timing", DiagnosticCode.LyricTimingUnspecified)
    }
    val ids = mutableSetOf<String>()
    lyric.agentsList.forEachIndexed { index, agent ->
        if (agent.id in ids) {
            diagnostics += Diagnostic("agents[$index]", DiagnosticCode.LyricAgentIdDuplicate)
        }
        // An empty id is reported by validateAgent and never resolves a reference.
        if (agent.id.isNotEmpty()) {
            ids += agent.id
        }
        diagnostics += validateAgent(agent, "agents[$index]")
    }
    if (lyric.hasMeta()) {
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
        val words = content?.wordsList.orEmpty()
        // A kind outside the enum turns out to need no range as readily as the zero value, so both are left unasked.
        val unresolvedType = type == LineType.LINE_TYPE_UNSPECIFIED || type == LineType.UNRECOGNIZED
        if (type != LineType.LINE_TYPE_INSTRUMENTAL) {
            agents.forEachIndexed { index, id ->
                if (id !in ids) {
                    diagnostics += Diagnostic("$path.agents[$index]", DiagnosticCode.LyricLineAgentDangling)
                }
            }
            anyWords = anyWords || words.isNotEmpty()
            anyContent = anyContent || words.isNotEmpty() || content?.hasText() == true
            // Line-level timing sits on the line itself, so a sung line needs its own range and may not be split into words.
            if (lineTimed && words.isNotEmpty()) {
                diagnostics += Diagnostic("$path.content.words", DiagnosticCode.LyricTimingLineWords)
            }
            // Only a kind known to sing is asked for a range, since an unresolved one may turn out to need none, and a node that is not allowed in the first place is asked for nothing.
            if (timed && time == null && !unresolvedType && !forbidden) {
                diagnostics += Diagnostic(childPath(path, "time"), DiagnosticCode.LyricTimingLineTimeMissing)
            }
            // A sung line is shown for as long as its range runs, so the range has to end somewhere.
            if (timed && time != null && !time.hasEnd() && !unresolvedType && !forbidden && !open) {
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
                if (word.hasTime()) {
                    diagnostics += Diagnostic("$path.content.words[$index].time", DiagnosticCode.LyricTimingNonePresent)
                }
            }
        }
    }

    lyric.linesList.forEachIndexed { index, line ->
        val path = "lines[$index]"
        val forbidden = line.type == LineType.LINE_TYPE_INSTRUMENTAL
        claimLineId(line.id, path)
        checkReferences(
            line.agentsList,
            line.time.takeIf { line.hasTime() },
            line.content.takeIf { line.hasContent() },
            path,
            line.type,
            open = index == lyric.linesCount - 1,
        )
        line.backgroundsList.forEachIndexed { backgroundIndex, background ->
            val backgroundPath = "$path.backgrounds[$backgroundIndex]"
            claimLineId(background.id, backgroundPath)
            checkReferences(
                background.agentsList,
                background.time.takeIf { background.hasTime() },
                background.content.takeIf { background.hasContent() },
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
    for (index in findUnordered(lyric.linesList) { line -> line.time.takeIf { line.hasTime() } }) {
        diagnostics += Diagnostic("lines[$index]", DiagnosticCode.LyricLinesUnordered)
    }
    // A rule that already spoke about a path keeps the sweep off it, and validateAgent reports an all-default agent at the agent rather than inside it.
    val covered = diagnostics.map { it.path } + lyric.agentsList.indices.map { "agents[$it]" }
    for (path in findDefaultEntries(lyric, covered)) {
        diagnostics += Diagnostic(path, DiagnosticCode.LyricListEntryEmpty)
    }
    return diagnostics
}

/**
 * Returns a copy of the lyric in canonical order: lines and their backgrounds by start time.
 */
public fun orderLyric(lyric: Lyric): Lyric {
    val builder = lyric.toBuilder().clearLines()
        .addAllLines(lyric.linesList.sortedWith(byTime { line -> line.time.takeIf { line.hasTime() } }).map(::orderLine))

    return builder.build()
}

/**
 * Returns a canonical copy of the storage lyric: format lowercased, meta/agents/lines canonicalized, lines ordered.
 * Generated messages are immutable, so unchanged submessages may be shared while the input remains unchanged.
 */
public fun canonicalizeLyric(lyric: Lyric): Lyric {
    val builder = lyric.toBuilder().setFormat(lyric.format.lowercase()).clearMeta()
        .clearAgents().addAllAgents(canonicalizeList(lyric.agentsList, ::canonicalizeAgent))
        .clearLines().addAllLines(
            canonicalizeList(lyric.linesList, ::canonicalizeLine)
                .sortedWith(byTime { line -> line.time.takeIf { line.hasTime() } }),
        )
    val meta = canonicalizeField(lyric.meta.takeIf { lyric.hasMeta() }, ::canonicalizeMeta)
    if (meta != null) {
        builder.meta = meta
    }

    return builder.build()
}

/**
 * Encodes a storage Lyric to bytes.
 */
public fun encode(lyric: Lyric): ByteArray = lyric.toByteArray()

/**
 * Decodes a storage Lyric from bytes, keeping unknown fields so a round trip loses nothing.
 * It throws on malformed bytes and leaves the schema's rules to validateLyric.
 */
public fun decode(bytes: ByteArray): Lyric = Lyric.parseFrom(bytes)
