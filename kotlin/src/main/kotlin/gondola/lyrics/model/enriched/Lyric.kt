@file:JvmName("LyricHelper")

package gondola.lyrics.model.enriched

import gondola.lyrics.model.SCHEMA_VERSION
import gondola.lyrics.model.common.Agent
import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.common.canonicalizeAgent
import gondola.lyrics.model.common.canonicalizeMeta
import gondola.lyrics.model.common.validateAgent
import gondola.lyrics.model.common.validateLyricParts
import gondola.lyrics.model.common.validateMeta
import gondola.lyrics.model.utils.SEMVER_PATTERN
import gondola.lyrics.model.utils.byStartTime
import gondola.lyrics.model.utils.canonicalizeField
import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.findUnorderedStartTimeIndices
import gondola.lyrics.model.utils.isUnresolved
import gondola.lyrics.model.utils.read
import gondola.lyrics.model.utils.write
import gondola.lyrics.model.utils.decodeEnrichedLyric as decodeEnrichedLyricMessage
import gondola.lyrics.model.utils.encodeEnrichedLyric as encodeEnrichedLyricMessage

/**
 * Creates a lyric using the current schema version.
 */
public fun makeEnrichedLyric(
    status: LyricStatus,
    format: String = "",
    profile: String = "",
    timing: TimingLevel = TimingLevel.TIMING_LEVEL_UNSPECIFIED,
    meta: Meta? = null,
    agents: List<Agent> = emptyList(),
    lines: List<Line> = emptyList(),
    languageUsages: List<LanguageUsage> = emptyList(),
    extra: Map<String, String> = emptyMap(),
): Lyric {
    require(status == LyricStatus.LYRIC_STATUS_VALID || status == LyricStatus.LYRIC_STATUS_INVALID) {
        "status must be LYRIC_STATUS_VALID or LYRIC_STATUS_INVALID"
    }
    return Lyric(
        status = status,
        version = SCHEMA_VERSION,
        format = format,
        profile = profile,
        timing = timing,
        meta = meta,
        agents = agents,
        lines = lines,
        languageUsages = languageUsages,
        extra = extra,
    )
}

/**
 * Checks lyric-wide constraints and validates nested metadata, agents, and lines.
 */
public fun validateEnrichedLyric(lyric: Lyric): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (!SEMVER_PATTERN.matches(lyric.version)) {
        diagnostics += Diagnostic("version", DiagnosticCode.LyricVersionMalformed)
    }
    if (isUnresolved(lyric.status)) {
        diagnostics += Diagnostic("status", DiagnosticCode.LyricStatusUnspecified)
    }
    // An unresolved timing level leaves every timing rule with nothing to hold the lyric to, so a lyric that never stated one is reported rather than read as untimed.
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
    val languageTags = mutableSetOf<String>()
    lyric.languageUsages.forEachIndexed { index, usage ->
        val path = "languageUsages[$index]"
        if (!languageTags.add(usage.tag.lowercase())) {
            diagnostics += Diagnostic(path, DiagnosticCode.LyricLanguageUsagesTagDuplicate)
        }
        diagnostics += validateEnrichedLanguageUsage(usage, path)
    }
    // Derived usages define counts and order; tag spelling compares without case.
    val derived = deriveEnrichedLanguageUsages(lyric.lines)
    val sameLanguageUsages = lyric.languageUsages.size == derived.size && lyric.languageUsages.zip(derived).all { (usage, expected) ->
        usage.tag.lowercase() == expected.tag && usage.lineCount == expected.lineCount
    }
    if (!sameLanguageUsages) {
        diagnostics += Diagnostic("languageUsages", DiagnosticCode.LyricLanguageUsagesMismatch)
    }
    val lineTimed = lyric.timing == TimingLevel.TIMING_LEVEL_LINE
    val timed = lineTimed || lyric.timing == TimingLevel.TIMING_LEVEL_WORD
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
     * Checks global agent references and the end requirement of non-final sung lines.
     * Forbidden backgrounds still participate in reference resolution, but require no additional timing fields.
     */
    fun checkReferences(
        agentIds: List<String>,
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
            agentIds.forEachIndexed { index, id ->
                if (id !in ids) {
                    diagnostics += Diagnostic("$path.agentIds[$index]", DiagnosticCode.LyricLineAgentDangling)
                }
            }
            anyWords = anyWords || words.isNotEmpty()
            anyContent = anyContent || words.isNotEmpty() || content?.text != null
            // A sung line is shown for as long as its range runs, so the range has to end somewhere.
            if (timed && time != null && time.end == null && !unresolvedType && !forbidden && !open) {
                diagnostics += Diagnostic(childPath(path, "time.end"), DiagnosticCode.LyricLineTimeEndMissing)
            }
        }
    }

    lyric.lines.forEachIndexed { index, line ->
        val path = "lines[$index]"
        val forbidden = line.type == LineType.LINE_TYPE_INSTRUMENTAL
        claimLineId(line.id, path)
        checkReferences(
            line.agentIds,
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
                background.agentIds,
                background.time,
                background.content,
                backgroundPath,
                forbidden = forbidden,
                open = true,
            )
        }
        diagnostics += validateEnrichedLine(line, path, lyric.timing)
    }
    // Word-level timing needs only one line split into words, since a word-level source may leave the rest whole; a lyric with no content at all declares nothing to check.
    if (lyric.timing == TimingLevel.TIMING_LEVEL_WORD && anyContent && !anyWords) {
        diagnostics += Diagnostic("timing", DiagnosticCode.LyricTimingWordMissing)
    }
    for (index in findUnorderedStartTimeIndices(lyric.lines) { line -> line.time }) {
        diagnostics += Diagnostic("lines[$index]", DiagnosticCode.LyricLinesUnordered)
    }
    diagnostics += validateLyricParts(lyric.lines.map { it.part }, lyric.lines.indexOfLast { it.type == LineType.LINE_TYPE_NORMAL })
    return diagnostics
}

/**
 * Orders lines and backgrounds stably by start time and language usages by count and tag.
 */
public fun orderEnrichedLyric(lyric: Lyric): Lyric {
    return lyric.copy(
        lines = lyric.lines.sortedWith(byStartTime { line -> line.time }).map(::orderEnrichedLineBackgrounds),
        languageUsages = orderEnrichedLanguageUsages(lyric.languageUsages),
    )
}

/**
 * Normalizes tags and nested data, removes empty entries, and orders lines.
 */
public fun canonicalizeEnrichedLyric(lyric: Lyric): Lyric {
    return lyric.copy(
        format = lyric.format.lowercase(),
        profile = lyric.profile.lowercase(),
        meta = canonicalizeField(lyric.meta, ::canonicalizeMeta),
        agents = canonicalizeList(lyric.agents, ::canonicalizeAgent),
        lines = canonicalizeList(lyric.lines, ::canonicalizeEnrichedLine).sortedWith(byStartTime { line -> line.time }),
        languageUsages = canonicalizeEnrichedLanguageUsages(lyric.languageUsages),
        extra = lyric.extra.toMap(),
    )
}

/**
 * Encodes a lyric using the Protobuf wire format.
 */
public fun encodeEnrichedLyric(lyric: Lyric): ByteArray {
    return write(::encodeEnrichedLyricMessage, lyric)
}

/**
 * Decodes a lyric and discards fields outside the schema.
 */
public fun decodeEnrichedLyric(bytes: ByteArray): Lyric {
    return read(::decodeEnrichedLyricMessage, bytes)
}
