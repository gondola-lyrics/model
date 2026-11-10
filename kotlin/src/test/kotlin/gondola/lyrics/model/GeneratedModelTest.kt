package gondola.lyrics.model

import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.storage.Line
import gondola.lyrics.model.storage.Lyric
import gondola.lyrics.model.storage.decode
import gondola.lyrics.model.storage.encode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class GeneratedModelTest {
    @Test
    fun roundTripPreservesUnknownEndAndExplicitZeroEnd() {
        val original = Lyric(
            version = SCHEMA_VERSION,
            timing = Timing.TIMING_LINE,
            lines = listOf(Line(time = TimeRange(start = 1000)), Line(time = TimeRange(end = 0))),
        )

        val decoded = decode(encode(original))

        assertEquals(original, decoded)
        val open = assertNotNull(decoded.lines[0].time)
        assertEquals(1000L, open.start)
        assertNull(open.end)
        assertEquals(0L, assertNotNull(decoded.lines[1].time).end)
    }
}
