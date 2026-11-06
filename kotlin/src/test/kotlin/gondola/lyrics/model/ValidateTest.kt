package gondola.lyrics.model

import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.makeTimeRange
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
import gondola.lyrics.model.runtime.validateLyric
import kotlin.test.Test
import kotlin.test.assertEquals
import gondola.lyrics.model.storage.makeLineContentText as makeStorageLineContentText
import gondola.lyrics.model.storage.makeLineNormal as makeStorageLineNormal
import gondola.lyrics.model.storage.makeLyric as makeStorageLyric
import gondola.lyrics.model.storage.validateLyric as validateStorageLyric

private fun textLine(start: Long, end: Long? = null): Line =
    makeLineNormal(time = makeTimeRange(start = start, end = end), content = makeLineContentText("x"))

private fun lineTimed(vararg lines: Line): Lyric =
    makeLyric(format = "lrc", timing = Timing.TIMING_LINE, status = LyricStatus.LYRIC_STATUS_VALID, lines = lines.toList())

private fun List<Diagnostic>.asPairs(): List<Pair<String, String>> = map { it.path to it.code.value }

class ValidateTest {
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
