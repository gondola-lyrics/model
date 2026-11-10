package gondola.lyrics.model

import gondola.lyrics.model.common.AgentType
import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.WordType
import gondola.lyrics.model.common.deriveLineLanguages
import gondola.lyrics.model.common.getTimeRangeDuration
import gondola.lyrics.model.common.makeAgent
import gondola.lyrics.model.common.makeText
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.resolveDiagnosticPath
import gondola.lyrics.model.common.resolveLineAgents
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.common.validateWord
import gondola.lyrics.model.runtime.Line
import gondola.lyrics.model.runtime.LineContent
import gondola.lyrics.model.runtime.Lyric
import gondola.lyrics.model.runtime.Word
import gondola.lyrics.model.runtime.makeLineContentWords
import gondola.lyrics.model.runtime.makeLineNormal
import gondola.lyrics.model.runtime.makeWordNormal
import gondola.lyrics.model.runtime.makeWordSpace
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class HelpersTest {
    @Test
    fun derivesLowercasedLineLanguagesWithoutRepeats() {
        val line = makeLineNormal(languages = listOf("JA-JP", "ja-jp", "EN"))
        val languages = deriveLineLanguages(line)

        assertEquals(listOf("ja-jp", "en"), languages)
        assertEquals(listOf("JA-JP", "ja-jp", "EN"), line.languages)
    }

    @Test
    fun fallsBackToWordLanguages() {
        val line = makeLineNormal(
            content = makeLineContentWords(
                listOf(
                    makeWordNormal(text = "hi", language = "EN"),
                    makeWordSpace(text = " "),
                    makeWordNormal(text = "there", language = "en"),
                ),
            ),
        )
        assertEquals(listOf("en"), deriveLineLanguages(line))
    }

    // Resolving has to agree with what validate reports about a duplicate and an empty id, or the two tell different stories.
    @Test
    fun keepsFirstAgentClaimingId() {
        val agents = listOf(
            makeAgent(id = "a", type = AgentType.AGENT_TYPE_PERSON, names = listOf(makeText(text = "first"))),
            makeAgent(id = "a", type = AgentType.AGENT_TYPE_PERSON, names = listOf(makeText(text = "second"))),
        )
        val resolved = resolveLineAgents(makeLineNormal(agents = listOf("a")), agents)
        assertEquals(listOf("first"), resolved.map { it.names[0].text })
    }

    @Test
    fun resolvesNeitherEmptyNorUnknownAgentId() {
        val agents = listOf(makeAgent(id = "", type = AgentType.AGENT_TYPE_PERSON), makeAgent(id = "a", type = AgentType.AGENT_TYPE_PERSON))
        assertEquals(emptyList(), resolveLineAgents(makeLineNormal(agents = listOf("", "ghost")), agents))
    }

    // The wire range is wider than the schema's time range, so construction and validation enforce different bounds.
    @Test
    fun preservesUnsignedBoundsWithoutTruncation() {
        val overflow = makeTimeRange(start = 4294967295L, end = 0)
        assertEquals(listOf(Diagnostic("time", DiagnosticCode.TimeRangeStartOverflow)), validateTimeRange(overflow, "time"))
        assertEquals(-4294967295L, getTimeRangeDuration(overflow))
        assertFailsWith<IllegalArgumentException> { makeTimeRange(start = -1) }
        assertFailsWith<IllegalArgumentException> { makeTimeRange(end = 4294967296L) }
    }

    @Test
    fun resolvesNativeDiagnosticPathsWithPresenceAndNumericValues() {
        val lyric = Lyric(
            timing = Timing(99),
            meta = Meta(duration = 4294967295L),
            extra = mapOf("\$private" to "kept"),
            lines = listOf(
                Line(time = TimeRange(end = 0), content = LineContent(words = listOf(Word(type = WordType(-1), language = "")))),
            ),
        )

        assertEquals(99, resolveDiagnosticPath(lyric, "timing"))
        assertEquals(4294967295L, resolveDiagnosticPath(lyric, "meta.duration"))
        assertEquals(0L, resolveDiagnosticPath(lyric, "lines[0].time.end"))
        assertEquals(-1, resolveDiagnosticPath(lyric, "lines[0].content.words[0].type"))
        assertEquals("", resolveDiagnosticPath(lyric, "lines[0].content.words[0].language"))
        assertEquals("kept", resolveDiagnosticPath(lyric, "extra.\$private"))
        assertNull(resolveDiagnosticPath(lyric, "lines[0].content.words[0].time"))
        assertNull(resolveDiagnosticPath(lyric, "lines[1].time"))
        assertNull(resolveDiagnosticPath(lyric, "lines[0].missing"))
    }

    // Java whitespace classes differ from Unicode White_Space, so the explicit JVM character set needs its own regression check.
    @Test
    fun wordSeparatorsUseUnicodeWhiteSpace() {
        for (separator in listOf("\u0085", "\u00a0", "\u2007", "\u202f")) {
            assertEquals(emptyList(), validateWord(makeWordSpace(text = separator)))
            assertEquals(listOf(Diagnostic("text", DiagnosticCode.WordTextSeparator)), validateWord(makeWordNormal(text = "a${separator}b")))
        }
        assertEquals(emptyList(), validateWord(makeWordNormal(text = "a\u200bb")))
        assertEquals(listOf(Diagnostic("text", DiagnosticCode.WordTextNotSeparator)), validateWord(makeWordSpace(text = "\u200b")))
    }
}
