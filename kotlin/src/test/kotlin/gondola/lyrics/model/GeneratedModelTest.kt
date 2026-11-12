package gondola.lyrics.model

import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.document.Line
import gondola.lyrics.model.document.Lyric
import gondola.lyrics.model.document.decodeDocumentLyric
import gondola.lyrics.model.document.encodeDocumentLyric
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class GeneratedModelTest {
    @Test
    fun roundTripPreservesUnknownEndAndExplicitZeroEnd() {
        val original = Lyric(
            version = SCHEMA_VERSION,
            timing = TimingLevel.TIMING_LEVEL_LINE,
            lines = listOf(Line(time = TimeRange(start = 1000)), Line(time = TimeRange(end = 0))),
        )

        val decoded = decodeDocumentLyric(encodeDocumentLyric(original))

        assertEquals(original, decoded)
        val open = assertNotNull(decoded.lines[0].time)
        assertEquals(1000L, open.start)
        assertNull(open.end)
        assertEquals(0L, assertNotNull(decoded.lines[1].time).end)
    }
}
