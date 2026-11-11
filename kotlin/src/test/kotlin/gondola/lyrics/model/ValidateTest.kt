package gondola.lyrics.model

import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.makeLineAnnotation
import gondola.lyrics.model.common.makeLineAnnotationRoman
import gondola.lyrics.model.common.makeLineAnnotationTranslation
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.makeWordAnnotation
import gondola.lyrics.model.common.makeWordAnnotationRoman
import gondola.lyrics.model.common.makeWordAnnotationRuby
import gondola.lyrics.model.common.makeWordAnnotationToken
import gondola.lyrics.model.common.makeWordAnnotationTranslation
import gondola.lyrics.model.common.validateLineAnnotation
import gondola.lyrics.model.common.validateMeta
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.common.validateWordAnnotation
import gondola.lyrics.model.runtime.LanguageUsage
import gondola.lyrics.model.runtime.Line
import gondola.lyrics.model.runtime.Lyric
import gondola.lyrics.model.runtime.LyricStatus
import gondola.lyrics.model.runtime.deriveLanguageUsages
import gondola.lyrics.model.runtime.makeLineContentText
import gondola.lyrics.model.runtime.makeLineContentWords
import gondola.lyrics.model.runtime.makeLineInstrumental
import gondola.lyrics.model.runtime.makeLineNormal
import gondola.lyrics.model.runtime.makeLyric
import gondola.lyrics.model.runtime.makeWordNormal
import gondola.lyrics.model.runtime.makeWordSpace
import gondola.lyrics.model.runtime.validateLanguageUsage
import gondola.lyrics.model.runtime.validateLine
import gondola.lyrics.model.runtime.validateLyric
import kotlin.test.Test
import kotlin.test.assertEquals
import gondola.lyrics.model.storage.makeLineContentText as makeStorageLineContentText
import gondola.lyrics.model.storage.makeLineNormal as makeStorageLineNormal
import gondola.lyrics.model.storage.makeLyric as makeStorageLyric
import gondola.lyrics.model.storage.validateLyric as validateStorageLyric

private fun textLine(start: Long, end: Long? = null): Line {
    return makeLineNormal(time = makeTimeRange(start = start, end = end), content = makeLineContentText("x"))
}

private fun lineTimed(vararg lines: Line): Lyric {
    return makeLyric(format = "lrc", timing = Timing.TIMING_LINE, status = LyricStatus.LYRIC_STATUS_VALID, lines = lines.toList())
}

private fun List<Diagnostic>.asPairs(): List<Pair<String, String>> {
    return map { it.path to it.code.value }
}

class ValidateTest {
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
        assertEquals(
            listOf(
                "rubies[3]" to "line.word.annotation.rubies.duplicate",
                "rubies[5]" to "line.word.annotation.rubies.duplicate",
                "romans[3]" to "line.word.annotation.romans.duplicate",
                "romans[5]" to "line.word.annotation.romans.duplicate",
                "translations[1]" to "line.word.annotation.translations.language.duplicate",
            ),
            validateWordAnnotation(word).asPairs(),
        )
        assertEquals(
            listOf(
                "romans[3]" to "line.annotation.romans.duplicate",
                "romans[5]" to "line.annotation.romans.duplicate",
                "translations[1]" to "line.annotation.translations.language.duplicate",
            ),
            validateLineAnnotation(line).asPairs(),
        )
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
        val lyric = makeStorageLyric(
            format = "lrc",
            lines = listOf(
                makeStorageLineNormal(
                    time = makeTimeRange(start = 1000),
                    languages = listOf("en"),
                    content = makeStorageLineContentText("hi there"),
                ),
            ),
        )
        assertEquals(listOf("timing" to "lyric.timing.unspecified"), validateStorageLyric(lyric).asPairs())
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

    // The two layers hold the same rule in two implementations, so the storage one is checked against the same case.
    @Test
    fun reportsLineLeftOpenAboveInStorageLayer() {
        val lyric = makeStorageLyric(
            format = "lrc",
            timing = Timing.TIMING_LINE,
            lines = listOf(
                makeStorageLineNormal(time = makeTimeRange(start = 0), content = makeStorageLineContentText("x")),
                makeStorageLineNormal(time = makeTimeRange(start = 1000, end = 2000), content = makeStorageLineContentText("y")),
            ),
        )
        assertEquals(listOf("lines[0].time.end" to "lyric.line.time.end.missing"), validateStorageLyric(lyric).asPairs())
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
