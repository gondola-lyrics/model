package gondola.lyrics.model

import gondola.lyrics.model.common.PartType
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.makePart
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.runtime.Lyric
import gondola.lyrics.model.runtime.LyricStatus
import gondola.lyrics.model.runtime.canonicalizeLyric
import gondola.lyrics.model.runtime.deriveLanguageUsages
import gondola.lyrics.model.runtime.makeLineContentWords
import gondola.lyrics.model.runtime.makeLineNormal
import gondola.lyrics.model.runtime.makeLyric
import gondola.lyrics.model.runtime.makeWordEmphasis
import gondola.lyrics.model.runtime.makeWordNormal
import gondola.lyrics.model.runtime.validateLyric
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals

class CanonicalizeTest {
    private fun buildLyric(): Lyric {
        val lines = listOf(
            makeLineNormal(
                time = makeTimeRange(start = 1000, end = 2000),
                languages = listOf("EN"),
                part = makePart(type = PartType.PART_TYPE_VERSE, raw = "Verse 1"),
                content = makeLineContentWords(
                    listOf(
                        makeWordNormal(
                            text = "hi",
                            language = "EN",
                            time = makeTimeRange(start = 1000, end = 2000),
                            emphasis = makeWordEmphasis(value = true),
                        ),
                    ),
                ),
            ),
        )
        return makeLyric(
            format = "LRC",
            timing = Timing.TIMING_WORD,
            status = LyricStatus.LYRIC_STATUS_VALID,
            languages = deriveLanguageUsages(lines),
            lines = lines,
        )
    }

    @Test
    fun lowercasesFormatAndTags() {
        val canonical = canonicalizeLyric(buildLyric())
        assertEquals("lrc", canonical.format)
        assertEquals(listOf("en"), canonical.getLines(0).languagesList)
        assertEquals("en", canonical.getLines(0).content.getWords(0).language)
    }

    @Test
    fun isIdempotent() {
        val once = canonicalizeLyric(buildLyric())
        assertEquals(once, canonicalizeLyric(once))
    }

    // Generated messages are immutable, so the Node copy contract is checked through unchanged input rather than object identity.
    @Test
    fun leavesInputUnchanged() {
        val lyric = buildLyric()
        val original = lyric.toByteArray()

        canonicalizeLyric(lyric)

        assertContentEquals(original, lyric.toByteArray())
    }

    @Test
    fun leavesCanonicalLyricValid() {
        assertEquals(emptyList(), validateLyric(canonicalizeLyric(buildLyric())))
    }
}
