package gondola.lyrics.model

import gondola.lyrics.model.common.AgentType
import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.common.getTimeRangeDuration
import gondola.lyrics.model.common.makeAgent
import gondola.lyrics.model.common.makeText
import gondola.lyrics.model.common.makeTextToken
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.resolveDiagnosticPath
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.enriched.Line
import gondola.lyrics.model.enriched.LineContent
import gondola.lyrics.model.enriched.Lyric
import gondola.lyrics.model.enriched.Word
import gondola.lyrics.model.enriched.WordType
import gondola.lyrics.model.enriched.deriveEnrichedLineLanguages
import gondola.lyrics.model.enriched.deriveEnrichedLineRomans
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRoman
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRomanContentText
import gondola.lyrics.model.enriched.makeEnrichedLineContentWords
import gondola.lyrics.model.enriched.makeEnrichedLineNormal
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotation
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotationRoman
import gondola.lyrics.model.enriched.makeEnrichedWordNormal
import gondola.lyrics.model.enriched.makeEnrichedWordSpace
import gondola.lyrics.model.enriched.resolveEnrichedLineAgents
import gondola.lyrics.model.enriched.validateEnrichedWord
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class HelpersTest {
    @Test
    fun derivesRomansSeparatelyBySchemeInFirstAppearanceOrder() {
        val first = makeEnrichedWordAnnotation(
            romans = listOf(
                makeEnrichedWordAnnotationRoman(
                    language = "JA-Latn",
                    scheme = "HEPBURN",
                    tokens = listOf(makeTextToken(text = "shi")),
                ),
                makeEnrichedWordAnnotationRoman(
                    language = "ja-latn",
                    scheme = "kunrei",
                    tokens = listOf(makeTextToken(text = "si")),
                ),
                makeEnrichedWordAnnotationRoman(language = "ja-latn", tokens = listOf(makeTextToken(text = "default"))),
            ),
        )
        val last = makeEnrichedWordAnnotation(
            romans = listOf(
                makeEnrichedWordAnnotationRoman(
                    language = "ja-latn",
                    scheme = "KUNREI",
                    tokens = listOf(makeTextToken(text = "ti")),
                ),
                makeEnrichedWordAnnotationRoman(
                    language = "JA-LATN",
                    scheme = "hepburn",
                    tokens = listOf(makeTextToken(text = "chi")),
                ),
                makeEnrichedWordAnnotationRoman(language = "ja-latn", scheme = "", tokens = listOf(makeTextToken(text = "text"))),
            ),
        )
        val words = listOf(
            makeEnrichedWordSpace(text = " "),
            makeEnrichedWordNormal(text = "x", annotation = first),
            makeEnrichedWordSpace(text = "  "),
            makeEnrichedWordNormal(text = "omitted"),
            makeEnrichedWordNormal(text = "y", annotation = last),
            makeEnrichedWordSpace(text = " "),
        )
        val expected = listOf(
            makeEnrichedLineAnnotationRoman(
                language = "ja-latn",
                scheme = "hepburn",
                content = makeEnrichedLineAnnotationRomanContentText("shi chi"),
            ),
            makeEnrichedLineAnnotationRoman(language = "ja-latn", scheme = "kunrei", content = makeEnrichedLineAnnotationRomanContentText("si ti")),
            makeEnrichedLineAnnotationRoman(language = "ja-latn", content = makeEnrichedLineAnnotationRomanContentText("default text")),
        )
        assertEquals(expected, deriveEnrichedLineRomans(makeEnrichedLineContentWords(words)))
        val stored = gondola.lyrics.model.document.makeDocumentLineContentWords(
            words.map { word ->
                val annotation = word.annotation?.let { source ->
                    gondola.lyrics.model.document.makeDocumentWordAnnotation(
                        romans = source.romans.map { roman ->
                            gondola.lyrics.model.document.makeDocumentWordAnnotationRoman(
                                language = roman.language,
                                scheme = roman.scheme,
                                tokens = roman.tokens,
                            )
                        },
                    )
                }
                if (word.type == WordType.WORD_TYPE_SPACE) {
                    gondola.lyrics.model.document.makeDocumentWordSpace(text = word.text)
                } else {
                    gondola.lyrics.model.document.makeDocumentWordNormal(text = word.text, annotation = annotation)
                }
            },
        )
        assertEquals(
            listOf(
                Triple("ja-latn", "hepburn", "shi chi"),
                Triple("ja-latn", "kunrei", "si ti"),
                Triple("ja-latn", null, "default text"),
            ),
            gondola.lyrics.model.document.deriveDocumentLineRomans(stored).map {
                Triple(it.language, it.scheme, gondola.lyrics.model.document.getDocumentLineAnnotationRomanText(it))
            },
        )
        assertEquals("HEPBURN", first.romans[0].scheme)
    }

    @Test
    fun derivesLowercasedLineLanguagesWithoutRepeats() {
        val line = makeEnrichedLineNormal(languages = listOf("JA-JP", "ja-jp", "EN"))
        val languages = deriveEnrichedLineLanguages(line)

        assertEquals(listOf("ja-jp", "en"), languages)
        assertEquals(listOf("JA-JP", "ja-jp", "EN"), line.languages)
    }

    @Test
    fun fallsBackToWordLanguages() {
        val line = makeEnrichedLineNormal(
            content = makeEnrichedLineContentWords(
                listOf(
                    makeEnrichedWordNormal(text = "hi", language = "EN"),
                    makeEnrichedWordSpace(text = " "),
                    makeEnrichedWordNormal(text = "there", language = "en"),
                ),
            ),
        )
        assertEquals(listOf("en"), deriveEnrichedLineLanguages(line))
    }

    // Resolving has to agree with what validate reports about a duplicate and an empty id, or the two tell different stories.
    @Test
    fun keepsFirstAgentClaimingId() {
        val agents = listOf(
            makeAgent(id = "a", type = AgentType.AGENT_TYPE_PERSON, names = listOf(makeText(text = "first"))),
            makeAgent(id = "a", type = AgentType.AGENT_TYPE_PERSON, names = listOf(makeText(text = "second"))),
        )
        val resolved = resolveEnrichedLineAgents(makeEnrichedLineNormal(agentIds = listOf("a")), agents)
        assertEquals(listOf("first"), resolved.map { it.names[0].text })
    }

    @Test
    fun resolvesNeitherEmptyNorUnknownAgentId() {
        val agents = listOf(makeAgent(id = "", type = AgentType.AGENT_TYPE_PERSON), makeAgent(id = "a", type = AgentType.AGENT_TYPE_PERSON))
        assertEquals(emptyList(), resolveEnrichedLineAgents(makeEnrichedLineNormal(agentIds = listOf("", "ghost")), agents))
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
            timing = TimingLevel(99),
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
            assertEquals(emptyList(), validateEnrichedWord(makeEnrichedWordSpace(text = separator)))
            assertEquals(
                listOf(Diagnostic("text", DiagnosticCode.WordTextSeparator)),
                validateEnrichedWord(makeEnrichedWordNormal(text = "a${separator}b")),
            )
        }
        assertEquals(emptyList(), validateEnrichedWord(makeEnrichedWordNormal(text = "a\u200bb")))
        assertEquals(listOf(Diagnostic("text", DiagnosticCode.WordTextNotSeparator)), validateEnrichedWord(makeEnrichedWordSpace(text = "\u200b")))
    }
}
