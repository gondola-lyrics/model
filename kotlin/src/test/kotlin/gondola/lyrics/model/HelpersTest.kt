package gondola.lyrics.model

import gondola.lyrics.model.common.AgentType
import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.getTimeRangeDuration
import gondola.lyrics.model.common.makeAgent
import gondola.lyrics.model.common.makeText
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.resolveDiagnosticPath
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.enriched.Line
import gondola.lyrics.model.enriched.LineContent
import gondola.lyrics.model.enriched.Lyric
import gondola.lyrics.model.enriched.Word
import gondola.lyrics.model.enriched.WordType
import gondola.lyrics.model.enriched.deriveLineLanguages
import gondola.lyrics.model.enriched.deriveLineRomans
import gondola.lyrics.model.enriched.makeLineAnnotationRoman
import gondola.lyrics.model.enriched.makeLineContentWords
import gondola.lyrics.model.enriched.makeLineNormal
import gondola.lyrics.model.enriched.makeWordAnnotation
import gondola.lyrics.model.enriched.makeWordAnnotationRoman
import gondola.lyrics.model.enriched.makeWordAnnotationToken
import gondola.lyrics.model.enriched.makeWordNormal
import gondola.lyrics.model.enriched.makeWordSpace
import gondola.lyrics.model.enriched.resolveLineAgents
import gondola.lyrics.model.enriched.validateWord
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class HelpersTest {
    @Test
    fun derivesRomansSeparatelyBySchemeInFirstAppearanceOrder() {
        val first = makeWordAnnotation(
            romans = listOf(
                makeWordAnnotationRoman(language = "JA-Latn", scheme = "HEPBURN", tokens = listOf(makeWordAnnotationToken(text = "shi"))),
                makeWordAnnotationRoman(language = "ja-latn", scheme = "kunrei", tokens = listOf(makeWordAnnotationToken(text = "si"))),
                makeWordAnnotationRoman(language = "ja-latn", tokens = listOf(makeWordAnnotationToken(text = "default"))),
            ),
        )
        val last = makeWordAnnotation(
            romans = listOf(
                makeWordAnnotationRoman(language = "ja-latn", scheme = "KUNREI", tokens = listOf(makeWordAnnotationToken(text = "ti"))),
                makeWordAnnotationRoman(language = "JA-LATN", scheme = "hepburn", tokens = listOf(makeWordAnnotationToken(text = "chi"))),
                makeWordAnnotationRoman(language = "ja-latn", scheme = "", tokens = listOf(makeWordAnnotationToken(text = "text"))),
            ),
        )
        val words = listOf(
            makeWordSpace(text = " "),
            makeWordNormal(text = "x", annotation = first),
            makeWordSpace(text = "  "),
            makeWordNormal(text = "omitted"),
            makeWordNormal(text = "y", annotation = last),
            makeWordSpace(text = " "),
        )
        val expected = listOf(
            makeLineAnnotationRoman(language = "ja-latn", scheme = "hepburn", text = "shi chi"),
            makeLineAnnotationRoman(language = "ja-latn", scheme = "kunrei", text = "si ti"),
            makeLineAnnotationRoman(language = "ja-latn", text = "default text"),
        )
        assertEquals(expected, deriveLineRomans(makeLineContentWords(words)))
        val stored = gondola.lyrics.model.document.makeLineContentWords(
            words.map { word ->
                val annotation = word.annotation?.let { source ->
                    gondola.lyrics.model.document.makeWordAnnotation(
                        romans = source.romans.map { roman ->
                            gondola.lyrics.model.document.makeWordAnnotationRoman(
                                language = roman.language,
                                scheme = roman.scheme,
                                tokens = roman.tokens.map { token ->
                                    gondola.lyrics.model.document.makeWordAnnotationToken(time = token.time, text = token.text)
                                },
                            )
                        },
                    )
                }
                if (word.type == WordType.WORD_TYPE_SPACE) {
                    gondola.lyrics.model.document.makeWordSpace(text = word.text)
                } else {
                    gondola.lyrics.model.document.makeWordNormal(text = word.text, annotation = annotation)
                }
            },
        )
        assertEquals(
            listOf(
                Triple("ja-latn", "hepburn", "shi chi"),
                Triple("ja-latn", "kunrei", "si ti"),
                Triple("ja-latn", null, "default text"),
            ),
            gondola.lyrics.model.document.deriveLineRomans(stored).map { Triple(it.language, it.scheme, it.text) },
        )
        assertEquals("HEPBURN", first.romans[0].scheme)
    }

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
