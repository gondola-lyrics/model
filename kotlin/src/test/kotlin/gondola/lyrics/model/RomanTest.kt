package gondola.lyrics.model

import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.document.LineAnnotationRoman
import gondola.lyrics.model.document.LineAnnotationRomanContent
import gondola.lyrics.model.document.LineAnnotationRomanToken
import gondola.lyrics.model.document.canonicalizeDocumentLineAnnotationRoman
import gondola.lyrics.model.document.getDocumentLineAnnotationRomanText
import gondola.lyrics.model.document.makeDocumentLineAnnotation
import gondola.lyrics.model.document.makeDocumentLineAnnotationRoman
import gondola.lyrics.model.document.makeDocumentLineAnnotationRomanContentText
import gondola.lyrics.model.document.makeDocumentLineAnnotationRomanContentTokens
import gondola.lyrics.model.document.makeDocumentLineAnnotationRomanToken
import gondola.lyrics.model.document.makeDocumentLineBackground
import gondola.lyrics.model.document.makeDocumentLineContentText
import gondola.lyrics.model.document.makeDocumentLineContentWords
import gondola.lyrics.model.document.makeDocumentLineNormal
import gondola.lyrics.model.document.makeDocumentLyric
import gondola.lyrics.model.document.makeDocumentWordAnnotation
import gondola.lyrics.model.document.makeDocumentWordAnnotationRoman
import gondola.lyrics.model.document.makeDocumentWordAnnotationToken
import gondola.lyrics.model.document.makeDocumentWordNormal
import gondola.lyrics.model.document.resolveDocumentLineAnnotationRomanTime
import gondola.lyrics.model.document.resolveDocumentLineAnnotationRomanTokenTime
import gondola.lyrics.model.document.validateDocumentLine
import gondola.lyrics.model.document.validateDocumentLineAnnotationRoman
import gondola.lyrics.model.document.validateDocumentLyric
import gondola.lyrics.model.enriched.canonicalizeEnrichedLineAnnotationRoman
import gondola.lyrics.model.enriched.getEnrichedLineAnnotationRomanText
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotation
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRoman
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRomanContentText
import gondola.lyrics.model.enriched.makeEnrichedLineContentText
import gondola.lyrics.model.enriched.makeEnrichedLineNormal
import gondola.lyrics.model.enriched.resolveEnrichedLineAnnotationRomanTokenTime
import gondola.lyrics.model.enriched.validateEnrichedLine
import gondola.lyrics.model.enriched.validateEnrichedLineAnnotationRoman
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class RomanTest {
    @Test
    fun checksExclusiveContentAndSourceTimingAnchorsInBothLayers() {
        val timed = LineAnnotationRomanToken(time = TimeRange(), text = "ni")
        val cases = listOf(
            LineAnnotationRoman() to listOf("content" to "line.annotation.roman.content.missing"),
            LineAnnotationRoman(content = LineAnnotationRomanContent()) to listOf("content" to "line.annotation.roman.content.missing"),
            LineAnnotationRoman(content = LineAnnotationRomanContent(text = "")) to
                listOf("content.text" to "line.annotation.roman.content.text.empty"),
            LineAnnotationRoman(content = LineAnnotationRomanContent(tokens = listOf(timed), text = "")) to listOf(
                "content" to "line.annotation.roman.content.ambiguous",
                "content.text" to "line.annotation.roman.content.text.empty",
            ),
            LineAnnotationRoman(content = LineAnnotationRomanContent(tokens = listOf(LineAnnotationRomanToken(text = "ni")))) to listOf(
                "content.tokens" to "line.annotation.roman.content.tokens.time.missing",
            ),
            LineAnnotationRoman(content = LineAnnotationRomanContent(tokens = listOf(LineAnnotationRomanToken(time = TimeRange())))) to listOf(
                "content.tokens[0].text" to "line.annotation.roman.token.text.empty",
            ),
        )
        for ((roman, expected) in cases) {
            assertEquals(expected, validateDocumentLineAnnotationRoman(roman).map { it.path to it.code.value })
            val enriched = gondola.lyrics.model.enriched.LineAnnotationRoman(
                content = roman.content?.let { content ->
                    gondola.lyrics.model.enriched.LineAnnotationRomanContent(
                        text = content.text,
                        tokens = content.tokens.map { token ->
                            gondola.lyrics.model.enriched.LineAnnotationRomanToken(time = token.time, text = token.text)
                        },
                    )
                },
            )
            assertEquals(expected, validateEnrichedLineAnnotationRoman(enriched).map { it.path to it.code.value })
        }
        val mixed = makeDocumentLineAnnotationRoman(
            content = makeDocumentLineAnnotationRomanContentTokens(listOf(timed, makeDocumentLineAnnotationRomanToken(text = " "))),
        )
        assertEquals(emptyList(), validateDocumentLineAnnotationRoman(mixed))
        assertEquals(
            emptyList(),
            validateDocumentLineAnnotationRoman(makeDocumentLineAnnotationRoman(content = makeDocumentLineAnnotationRomanContentText("ni hao"))),
        )
    }

    @Test
    fun keepsIndependentTimingAndUnknownEndsWithoutChangingOriginalPrecision() {
        val tokens = listOf(
            makeDocumentLineAnnotationRomanToken(time = TimeRange(start = 900, end = 1800), text = "ni"),
            makeDocumentLineAnnotationRomanToken(text = "  "),
            makeDocumentLineAnnotationRomanToken(time = TimeRange(start = 2300), text = "hao"),
        )
        val roman = makeDocumentLineAnnotationRoman(content = makeDocumentLineAnnotationRomanContentTokens(tokens))
        val line = makeDocumentLineNormal(
            time = TimeRange(start = 1000, end = 2000),
            content = makeDocumentLineContentText("original"),
            annotation = makeDocumentLineAnnotation(romans = listOf(roman)),
        )
        assertEquals("ni  hao", getDocumentLineAnnotationRomanText(roman))
        assertEquals(line.time, resolveDocumentLineAnnotationRomanTime(roman, line))
        assertEquals(line.time, resolveDocumentLineAnnotationRomanTokenTime(tokens[1], roman, line))
        val declared = roman.copy(time = TimeRange(start = 0, end = 3000))
        assertEquals(declared.time, resolveDocumentLineAnnotationRomanTokenTime(tokens[1], declared, line))
        assertEquals(TimeRange(start = 2300), resolveDocumentLineAnnotationRomanTokenTime(tokens[2], declared, line))
        assertEquals(
            listOf("content.tokens[2].time" to "line.annotation.roman.time.uncovered"),
            validateDocumentLineAnnotationRoman(declared).map { it.path to it.code.value },
        )
        assertEquals(emptyList(), validateDocumentLine(line, timing = Timing.TIMING_LINE))
        assertEquals(emptyList(), validateDocumentLyric(makeDocumentLyric(timing = Timing.TIMING_NONE, lines = listOf(line.copy(time = null)))))
        val background = makeDocumentLineBackground(time = line.time, content = line.content)
        assertEquals(background.time, resolveDocumentLineAnnotationRomanTokenTime(tokens[1], roman, background))

        val enrichedTokens = tokens.map { gondola.lyrics.model.enriched.LineAnnotationRomanToken(time = it.time, text = it.text) }
        val enrichedRoman =
            makeEnrichedLineAnnotationRoman(content = gondola.lyrics.model.enriched.LineAnnotationRomanContent(tokens = enrichedTokens))
        val enrichedLine = makeEnrichedLineNormal(
            time = line.time,
            content = makeEnrichedLineContentText("original"),
            annotation = makeEnrichedLineAnnotation(romans = listOf(enrichedRoman)),
        )
        assertEquals("ni  hao", getEnrichedLineAnnotationRomanText(enrichedRoman))
        assertEquals(TimeRange(start = 2300), resolveEnrichedLineAnnotationRomanTokenTime(enrichedTokens[2], enrichedRoman, enrichedLine))
        assertEquals(emptyList(), validateEnrichedLine(enrichedLine, timing = Timing.TIMING_LINE))
    }

    @Test
    fun canonicalizationCopiesContentWithoutChangingSourceBoundariesOrWhitespace() {
        val tokens = mutableListOf(
            makeDocumentLineAnnotationRomanToken(time = TimeRange(start = 2000), text = " ni"),
            makeDocumentLineAnnotationRomanToken(text = "  "),
            makeDocumentLineAnnotationRomanToken(time = TimeRange(start = 1000, end = 1800), text = "hao "),
        )
        val roman = makeDocumentLineAnnotationRoman(
            language = "ZH-Latn",
            scheme = "PINYIN",
            time = TimeRange(),
            content = makeDocumentLineAnnotationRomanContentTokens(tokens),
        )
        val canonical = canonicalizeDocumentLineAnnotationRoman(roman)
        assertEquals("zh-latn" to "pinyin", canonical.language to canonical.scheme)
        assertEquals(roman.content, canonical.content)
        assertEquals(" ni  hao ", getDocumentLineAnnotationRomanText(canonical))
        assertEquals(canonical, canonicalizeDocumentLineAnnotationRoman(canonical))
        tokens.clear()
        assertEquals(3, assertNotNull(canonical.content).tokens.size)
        val enriched = makeEnrichedLineAnnotationRoman(
            language = "ZH-Latn",
            scheme = "PINYIN",
            content = gondola.lyrics.model.enriched.LineAnnotationRomanContent(
                tokens = assertNotNull(canonical.content).tokens.map {
                    gondola.lyrics.model.enriched.LineAnnotationRomanToken(time = it.time, text = it.text)
                },
            ),
        )
        val enrichedCanonical = canonicalizeEnrichedLineAnnotationRoman(enriched)
        assertEquals(enriched.content, enrichedCanonical.content)
        assertEquals(" ni  hao ", getEnrichedLineAnnotationRomanText(enrichedCanonical))
        assertEquals("zh-latn" to "pinyin", enrichedCanonical.language to enrichedCanonical.scheme)
    }

    @Test
    fun checksPlacementWithinEachLineAndBackgroundWithoutCrossingSchemes() {
        val time = TimeRange(start = 1000, end = 2000)
        val roman =
            makeDocumentLineAnnotationRoman(language = "ZH-LATN", scheme = "PINYIN", content = makeDocumentLineAnnotationRomanContentText("ni"))
        val word = makeDocumentWordNormal(
            text = "x",
            time = time,
            annotation = makeDocumentWordAnnotation(
                romans = listOf(
                    makeDocumentWordAnnotationRoman(
                        language = "zh-latn",
                        scheme = "pinyin",
                        tokens = listOf(makeDocumentWordAnnotationToken(text = "ni")),
                    ),
                ),
            ),
        )
        val content = makeDocumentLineContentWords(listOf(word))
        val annotation = makeDocumentLineAnnotation(romans = listOf(roman))
        val background = makeDocumentLineBackground(time = time, content = content, annotation = annotation)
        val line = makeDocumentLineNormal(time = time, content = content, annotation = annotation, backgrounds = listOf(background))
        assertEquals(
            listOf(
                "annotation.romans[0]" to "line.annotation.romans.conflict",
                "backgrounds[0].annotation.romans[0]" to "line.annotation.romans.conflict",
            ),
            validateDocumentLine(line, timing = Timing.TIMING_WORD).map { it.path to it.code.value },
        )
        assertEquals(
            emptyList(),
            validateDocumentLine(line.copy(annotation = null, backgrounds = listOf(background.copy(content = makeDocumentLineContentText("bg"))))),
        )
        assertEquals(
            emptyList(),
            validateDocumentLine(
                line.copy(annotation = makeDocumentLineAnnotation(romans = listOf(roman.copy(scheme = "another"))), backgrounds = emptyList()),
            ),
        )
        val enrichedWord = gondola.lyrics.model.enriched.makeEnrichedWordNormal(
            text = "x",
            time = time,
            annotation = gondola.lyrics.model.enriched.makeEnrichedWordAnnotation(
                romans = listOf(
                    gondola.lyrics.model.enriched.makeEnrichedWordAnnotationRoman(
                        language = "zh-latn",
                        scheme = "pinyin",
                        tokens = listOf(gondola.lyrics.model.enriched.makeEnrichedWordAnnotationToken(text = "ni")),
                    ),
                ),
            ),
        )
        val enrichedContent = gondola.lyrics.model.enriched.makeEnrichedLineContentWords(listOf(enrichedWord))
        val enrichedAnnotation = makeEnrichedLineAnnotation(
            romans = listOf(
                makeEnrichedLineAnnotationRoman(
                    language = "ZH-LATN",
                    scheme = "PINYIN",
                    content = makeEnrichedLineAnnotationRomanContentText("ni"),
                ),
            ),
        )
        val enrichedBackground = gondola.lyrics.model.enriched.makeEnrichedLineBackground(
            time = time,
            content = enrichedContent,
            annotation = enrichedAnnotation,
        )
        val enrichedLine =
            makeEnrichedLineNormal(time = time, content = enrichedContent, annotation = enrichedAnnotation, backgrounds = listOf(enrichedBackground))
        assertEquals(
            validateDocumentLine(line, timing = Timing.TIMING_WORD).map { it.path to it.code.value },
            validateEnrichedLine(enrichedLine, timing = Timing.TIMING_WORD).map { it.path to it.code.value },
        )
    }
}
