package gondola.lyrics.model

import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.Part
import gondola.lyrics.model.common.PartType
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.makePart
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.validateMeta
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.enriched.LanguageUsage
import gondola.lyrics.model.enriched.Line
import gondola.lyrics.model.enriched.Lyric
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.canonicalizeLyric
import gondola.lyrics.model.enriched.deriveLanguageUsages
import gondola.lyrics.model.enriched.makeLineAnnotation
import gondola.lyrics.model.enriched.makeLineAnnotationRoman
import gondola.lyrics.model.enriched.makeLineAnnotationTranslation
import gondola.lyrics.model.enriched.makeLineContentText
import gondola.lyrics.model.enriched.makeLineContentWords
import gondola.lyrics.model.enriched.makeLineInstrumental
import gondola.lyrics.model.enriched.makeLineNormal
import gondola.lyrics.model.enriched.makeLyric
import gondola.lyrics.model.enriched.makeWordAnnotation
import gondola.lyrics.model.enriched.makeWordAnnotationRoman
import gondola.lyrics.model.enriched.makeWordAnnotationRuby
import gondola.lyrics.model.enriched.makeWordAnnotationToken
import gondola.lyrics.model.enriched.makeWordAnnotationTranslation
import gondola.lyrics.model.enriched.makeWordEmphasis
import gondola.lyrics.model.enriched.makeWordNormal
import gondola.lyrics.model.enriched.makeWordSpace
import gondola.lyrics.model.enriched.validateLanguageUsage
import gondola.lyrics.model.enriched.validateLine
import gondola.lyrics.model.enriched.validateLineAnnotation
import gondola.lyrics.model.enriched.validateLyric
import gondola.lyrics.model.enriched.validateWord
import gondola.lyrics.model.enriched.validateWordAnnotation
import kotlin.test.Test
import kotlin.test.assertEquals
import gondola.lyrics.model.document.makeLineContentText as makeDocumentLineContentText
import gondola.lyrics.model.document.makeLineNormal as makeDocumentLineNormal
import gondola.lyrics.model.document.makeLyric as makeDocumentLyric
import gondola.lyrics.model.document.validateLyric as validateDocumentLyric

private fun textLine(start: Long, end: Long? = null): Line {
    return makeLineNormal(time = makeTimeRange(start = start, end = end), content = makeLineContentText("x"))
}

private fun lineTimed(vararg lines: Line): Lyric {
    return makeLyric(format = "lrc", timing = Timing.TIMING_LINE, status = LyricStatus.LYRIC_STATUS_VALID, lines = lines.toList())
}

private fun List<Diagnostic>.asPairs(): List<Pair<String, String>> {
    return map { it.path to it.code.value }
}

private fun validatePartsInBothLayers(parts: List<Part?>): List<List<Diagnostic>> {
    val played = makeLyric(
        timing = Timing.TIMING_NONE,
        status = LyricStatus.LYRIC_STATUS_VALID,
        lines = parts.map { makeLineNormal(part = it, content = makeLineContentText("line")) },
    )
    val stored = makeDocumentLyric(
        timing = Timing.TIMING_NONE,
        lines = parts.map { makeDocumentLineNormal(part = it, content = makeDocumentLineContentText("line")) },
    )
    return listOf(validateLyric(played), validateDocumentLyric(stored))
}

class ValidateTest {
    @Test
    fun requiresEmphasisDecisionWhenOriginIsSet() {
        for (derived in listOf(false, true)) {
            val line = makeLineNormal(
                time = makeTimeRange(start = 1000, end = 5000),
                content = makeLineContentWords(
                    listOf(
                        makeWordNormal(
                            text = "ah",
                            time = makeTimeRange(start = 1000, end = 5000),
                            emphasis = makeWordEmphasis(derived = derived),
                        ),
                    ),
                ),
            )
            val lyric = canonicalizeLyric(
                makeLyric(timing = Timing.TIMING_WORD, status = LyricStatus.LYRIC_STATUS_VALID, lines = listOf(line)),
            )
            assertEquals(
                listOf("lines[0].content.words[0].emphasis.value" to "line.word.emphasis.value.missing"),
                validateLyric(lyric).asPairs(),
            )
            for (value in listOf(false, true)) {
                assertEquals(emptyList(), validateWord(makeWordNormal(text = "ah", emphasis = makeWordEmphasis(value = value, derived = derived))))
            }
        }
        assertEquals(emptyList(), validateWord(makeWordNormal(text = "ah", emphasis = makeWordEmphasis())))
        assertEquals(emptyList(), validateWord(makeWordNormal(text = "ah", emphasis = makeWordEmphasis(value = false))))
    }

    @Test
    fun allowsConsistentPartIdsAcrossAdjacentLinesWithExactComparison() {
        val part = makePart(type = PartType.PART_TYPE_CHORUS, id = "Chorus", raw = "chorus")
        val parts = listOf(
            part,
            part.copy(),
            part.copy(id = "chorus"),
            part.copy(id = null),
            part.copy(id = ""),
            null,
            makePart(type = PartType.PART_TYPE_VERSE, raw = "Verse 1"),
            makePart(type = PartType.PART_TYPE_VERSE, raw = "Verse 2"),
        )
        for (diagnostics in validatePartsInBothLayers(parts)) {
            assertEquals(emptyList(), diagnostics)
        }
    }

    @Test
    fun reportsInconsistentTypeOrRawForSamePartId() {
        val part = makePart(type = PartType.PART_TYPE_CHORUS, id = "Chorus", raw = "chorus")
        val parts = listOf(
            part,
            part.copy(type = PartType.PART_TYPE_VERSE),
            part.copy(raw = "Chorus"),
            makePart(type = PartType.PART_TYPE_CHORUS, id = "Other"),
            makePart(type = PartType.PART_TYPE_CHORUS, id = "Other", raw = ""),
        )
        for (diagnostics in validatePartsInBothLayers(parts)) {
            assertEquals(
                listOf(
                    "lines[1].part" to "lyric.part.mismatch",
                    "lines[2].part" to "lyric.part.mismatch",
                    "lines[4].part" to "lyric.part.mismatch",
                ),
                diagnostics.asPairs(),
            )
        }
    }

    @Test
    fun reportsReusedPartIdOnlyAtStartOfNewRun() {
        val part = makePart(type = PartType.PART_TYPE_CHORUS, id = "Chorus", raw = "chorus")
        val separators = listOf(part.copy(id = "Other"), null, part.copy(id = ""), part.copy(id = null))
        for (separator in separators) {
            for (diagnostics in validatePartsInBothLayers(listOf(part, separator, part, part))) {
                assertEquals(listOf("lines[2].part.id" to "lyric.part.id.reused"), diagnostics.asPairs())
            }
        }
    }

    @Test
    fun keysRomanAndRubyAnnotationsByLanguageAndScheme() {
        val identities = listOf(
            "JA-Latn" to "HEPBURN",
            "ja-latn" to "kunrei",
            "ja" to "hepburn",
            "ja-latn" to "hepburn",
            "ja-latn" to null,
            "JA-LATN" to "",
        )
        val word = makeWordAnnotation(
            rubies = identities.map { (language, scheme) -> makeWordAnnotationRuby(language = language, scheme = scheme) },
            romans = identities.map { (language, scheme) -> makeWordAnnotationRoman(language = language, scheme = scheme) },
            translations = listOf("zh-Hans", "ZH-HANS").map { makeWordAnnotationTranslation(language = it, text = "translation") },
        )
        val line = makeLineAnnotation(
            romans = identities.map { (language, scheme) -> makeLineAnnotationRoman(language = language, scheme = scheme, text = "roman") },
            translations = listOf("zh-Hans", "ZH-HANS").map { makeLineAnnotationTranslation(language = it, text = "translation") },
        )
        val expectedWord = listOf(
            "rubies[3]" to "line.word.annotation.rubies.duplicate",
            "rubies[5]" to "line.word.annotation.rubies.duplicate",
            "romans[3]" to "line.word.annotation.romans.duplicate",
            "romans[5]" to "line.word.annotation.romans.duplicate",
            "translations[1]" to "line.word.annotation.translations.language.duplicate",
        )
        val expectedLine = listOf(
            "romans[3]" to "line.annotation.romans.duplicate",
            "romans[5]" to "line.annotation.romans.duplicate",
            "translations[1]" to "line.annotation.translations.language.duplicate",
        )
        assertEquals(expectedWord, validateWordAnnotation(word).asPairs())
        assertEquals(expectedLine, validateLineAnnotation(line).asPairs())

        val documentWord = gondola.lyrics.model.document.makeWordAnnotation(
            rubies = identities.map { (language, scheme) ->
                gondola.lyrics.model.document.makeWordAnnotationRuby(language = language, scheme = scheme)
            },
            romans = identities.map { (language, scheme) ->
                gondola.lyrics.model.document.makeWordAnnotationRoman(language = language, scheme = scheme)
            },
            translations = listOf("zh-Hans", "ZH-HANS").map {
                gondola.lyrics.model.document.makeWordAnnotationTranslation(language = it, text = "translation")
            },
        )
        val documentLine = gondola.lyrics.model.document.makeLineAnnotation(
            romans = identities.map { (language, scheme) ->
                gondola.lyrics.model.document.makeLineAnnotationRoman(language = language, scheme = scheme, text = "roman")
            },
            translations = listOf("zh-Hans", "ZH-HANS").map {
                gondola.lyrics.model.document.makeLineAnnotationTranslation(language = it, text = "translation")
            },
        )
        assertEquals(expectedWord, gondola.lyrics.model.document.validateWordAnnotation(documentWord).asPairs())
        assertEquals(expectedLine, gondola.lyrics.model.document.validateLineAnnotation(documentLine).asPairs())
    }

    @Test
    fun validatesAnnotationLanguagesIndependentlyOfSchemes() {
        for (language in listOf("ja-latn", "ja_Latn")) {
            val scheme = "custom_romanization"
            val line = makeLineNormal(
                time = makeTimeRange(start = 0, end = 1000),
                content = makeLineContentWords(
                    listOf(
                        makeWordNormal(
                            text = "x",
                            time = makeTimeRange(start = 0, end = 1000),
                            annotation = makeWordAnnotation(
                                rubies = listOf(
                                    makeWordAnnotationRuby(
                                        language = language,
                                        scheme = scheme,
                                        tokens = listOf(makeWordAnnotationToken(text = "shi")),
                                    ),
                                ),
                                romans = listOf(
                                    makeWordAnnotationRoman(
                                        language = language,
                                        scheme = scheme,
                                        tokens = listOf(makeWordAnnotationToken(text = "shi")),
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
                annotation = makeLineAnnotation(romans = listOf(makeLineAnnotationRoman(language = language, scheme = scheme, text = "shi"))),
            )
            val expected = if (language == "ja-latn") {
                emptyList()
            } else {
                listOf(
                    "annotation.romans[0].language" to "language.tag.malformed",
                    "content.words[0].annotation.romans[0].language" to "language.tag.malformed",
                    "content.words[0].annotation.rubies[0].language" to "language.tag.malformed",
                )
            }
            assertEquals(expected, validateLine(line, timing = Timing.TIMING_WORD).asPairs().sortedBy { it.first })
        }
    }

    @Test
    fun reportsNativeTimeBoundsOutsideSchemaDomain() {
        assertEquals(
            listOf("time" to "time.range.start.invalid", "time" to "time.range.end.invalid"),
            validateTimeRange(TimeRange(start = -1, end = -2), "time").asPairs(),
        )
        assertEquals(
            listOf("time" to "time.range.start.overflow", "time" to "time.range.end.overflow"),
            validateTimeRange(TimeRange(start = 2147483648L, end = Long.MAX_VALUE), "time").asPairs(),
        )
    }

    @Test
    fun reportsNativeCountsAlongsideTagErrors() {
        assertEquals(
            listOf("languages[0].tag" to "language.usage.tag.empty", "languages[0].count" to "language.usage.count.invalid"),
            validateLanguageUsage(LanguageUsage(count = -1), "languages[0]").asPairs(),
        )
        assertEquals(
            listOf("count" to "language.usage.count.overflow"),
            validateLanguageUsage(LanguageUsage(tag = "en", count = 4294967296L)).asPairs(),
        )
    }

    @Test
    fun reportsNativeDurationBoundsOutsideSchemaDomain() {
        assertEquals(listOf("duration" to "meta.duration.invalid"), validateMeta(Meta(duration = -1)).asPairs())
        assertEquals(listOf("duration" to "meta.duration.overflow"), validateMeta(Meta(duration = Long.MAX_VALUE)).asPairs())
    }

    @Test
    fun acceptsWordLevelLyric() {
        val lines = listOf(
            makeLineNormal(
                time = makeTimeRange(start = 1000, end = 2000),
                languages = listOf("en"),
                content = makeLineContentWords(
                    listOf(
                        makeWordNormal(text = "hi", language = "en", time = makeTimeRange(start = 1000, end = 1500)),
                        makeWordSpace(text = " "),
                        makeWordNormal(text = "there", language = "en", time = makeTimeRange(start = 1500, end = 2000)),
                    ),
                ),
            ),
        )
        val lyric = makeLyric(
            format = "lrc",
            timing = Timing.TIMING_WORD,
            status = LyricStatus.LYRIC_STATUS_VALID,
            languages = deriveLanguageUsages(lines),
            lines = lines,
        )
        assertEquals(emptyList(), validateLyric(lyric))
    }

    // The codes are a contract the other bindings copy verbatim, so they are asserted as the strings they are.
    @Test
    fun reportsUndeclaredTiming() {
        val lyric = makeDocumentLyric(
            format = "lrc",
            lines = listOf(
                makeDocumentLineNormal(
                    time = makeTimeRange(start = 1000),
                    languages = listOf("en"),
                    content = makeDocumentLineContentText("hi there"),
                ),
            ),
        )
        assertEquals(listOf("timing" to "lyric.timing.unspecified"), validateDocumentLyric(lyric).asPairs())
    }

    @Test
    fun reportsUndeclaredLanguagesAndUnsplitWord() {
        val lyric = makeLyric(
            format = "lrc",
            timing = Timing.TIMING_WORD,
            status = LyricStatus.LYRIC_STATUS_VALID,
            lines = listOf(
                makeLineNormal(
                    time = makeTimeRange(start = 1000, end = 2000),
                    languages = listOf("en"),
                    content = makeLineContentWords(
                        listOf(makeWordNormal(text = "hi there", language = "en", time = makeTimeRange(start = 1000, end = 2000))),
                    ),
                ),
            ),
        )
        assertEquals(
            listOf(
                "languages" to "lyric.languages.mismatch",
                "lines[0].content.words[0].text" to "word.text.separator",
            ),
            validateLyric(lyric).asPairs(),
        )
    }

    // An untimed lyric marks out no stretches, so it reports the line itself instead of asking it for a range it may not have.
    @Test
    fun reportsInstrumentalLineInUntimedLyric() {
        val lyric = makeLyric(
            format = "lrc",
            timing = Timing.TIMING_NONE,
            status = LyricStatus.LYRIC_STATUS_VALID,
            lines = listOf(makeLineInstrumental()),
        )
        assertEquals(listOf("lines[0].type" to "lyric.timing.none.instrumental"), validateLyric(lyric).asPairs())
    }

    // A line other than the last ends where the timeline moves on, so one left open would be shown for the rest of the song.
    @Test
    fun reportsLineLeftOpenAbove() {
        val lyric = lineTimed(textLine(0, 1000), textLine(1000), textLine(2000, 3000))
        assertEquals(listOf("lines[1].time.end" to "lyric.line.time.end.missing"), validateLyric(lyric).asPairs())
    }

    // Nothing in a lyric states where it stops, so the last line is the one line whose end the data cannot carry.
    @Test
    fun acceptsLastLineLeftOpenAbove() {
        val lyric = lineTimed(textLine(0, 1000), textLine(1000, 2000), textLine(2000))
        assertEquals(emptyList(), validateLyric(lyric))
    }

    // A line carrying no range at all is already reported for that, so it is not asked for an end on top.
    @Test
    fun reportsLineWithNoRangeOnce() {
        val lyric = lineTimed(makeLineNormal(content = makeLineContentText("x")), textLine(1000, 2000))
        assertEquals(listOf("lines[0].time" to "lyric.timing.line.time_missing"), validateLyric(lyric).asPairs())
    }

    @Test
    fun reportsLineLeftOpenAboveInDocumentLayer() {
        val lyric = makeDocumentLyric(
            format = "lrc",
            timing = Timing.TIMING_LINE,
            lines = listOf(
                makeDocumentLineNormal(time = makeTimeRange(start = 0), content = makeDocumentLineContentText("x")),
                makeDocumentLineNormal(time = makeTimeRange(start = 1000, end = 2000), content = makeDocumentLineContentText("y")),
            ),
        )
        assertEquals(listOf("lines[0].time.end" to "lyric.line.time.end.missing"), validateDocumentLyric(lyric).asPairs())
    }

    // Word-level timing still marks out each line, and a line carrying no range leaves its words with nothing to fall inside.
    @Test
    fun reportsWordLevelLineWithNoRange() {
        val lines = listOf(
            makeLineNormal(
                content = makeLineContentWords(listOf(makeWordNormal(text = "x", time = makeTimeRange(start = 1000, end = 2000)))),
            ),
        )
        val lyric = makeLyric(format = "lrc", timing = Timing.TIMING_WORD, status = LyricStatus.LYRIC_STATUS_VALID, lines = lines)
        assertEquals(listOf("lines[0].time" to "lyric.timing.line.time_missing"), validateLyric(lyric).asPairs())
    }
}
