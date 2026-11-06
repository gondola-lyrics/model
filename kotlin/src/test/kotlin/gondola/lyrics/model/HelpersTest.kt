package gondola.lyrics.model

import gondola.lyrics.model.common.AgentType
import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.deriveLineLanguages
import gondola.lyrics.model.common.getTimeRangeDuration
import gondola.lyrics.model.common.makeAgent
import gondola.lyrics.model.common.makeText
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.resolveLineAgents
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.common.validateWord
import gondola.lyrics.model.runtime.makeLineContentWords
import gondola.lyrics.model.runtime.makeLineNormal
import gondola.lyrics.model.runtime.makeWordNormal
import gondola.lyrics.model.runtime.makeWordSpace
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class HelpersTest {
    @Test
    fun derivesLowercasedLineLanguagesWithoutRepeats() {
        val line = makeLineNormal(languages = listOf("JA-JP", "ja-jp", "EN"))
        val languages = deriveLineLanguages(line)

        assertEquals(listOf("ja-jp", "en"), languages)
        assertEquals(listOf("JA-JP", "ja-jp", "EN"), line.languagesList)
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
        assertEquals(listOf("first"), resolved.map { it.getNames(0).text })
    }

    @Test
    fun resolvesNeitherEmptyNorUnknownAgentId() {
        val agents = listOf(makeAgent(id = "", type = AgentType.AGENT_TYPE_PERSON), makeAgent(id = "a", type = AgentType.AGENT_TYPE_PERSON))
        assertEquals(emptyList(), resolveLineAgents(makeLineNormal(agents = listOf("", "ghost")), agents))
    }

    // Protobuf uint32 getters use signed Int bits on the JVM, so helpers must widen them before arithmetic or validation.
    @Test
    fun preservesUnsignedBoundsWithoutTruncation() {
        val overflow = makeTimeRange(start = 4294967295L, end = 0)
        assertEquals(listOf(Diagnostic("time", DiagnosticCode.TimeRangeStartOverflow)), validateTimeRange(overflow, "time"))
        assertEquals(-4294967295L, getTimeRangeDuration(overflow))
        assertFailsWith<IllegalArgumentException> { makeTimeRange(start = -1) }
        assertFailsWith<IllegalArgumentException> { makeTimeRange(end = 4294967296L) }
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
