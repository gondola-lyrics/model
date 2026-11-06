package gondola.lyrics.model

import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.timeRange
import gondola.lyrics.model.storage.Lyric
import gondola.lyrics.model.storage.lyric
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GeneratedModelTest {
    @Test
    fun roundTripPreservesUnknownEndAndExplicitZeroEnd() {
        val original = lyric {
            version = SCHEMA_VERSION
            timing = Timing.TIMING_LINE
            lines +=
                gondola.lyrics.model.storage.line {
                    time = timeRange { start = 1000 }
                }
            lines +=
                gondola.lyrics.model.storage.line {
                    time = timeRange { end = 0 }
                }
        }

        val decoded = Lyric.parseFrom(original.toByteArray())

        assertEquals(original, decoded)
        assertTrue(decoded.getLines(0).hasTime())
        assertEquals(1000, decoded.getLines(0).time.start)
        assertFalse(decoded.getLines(0).time.hasEnd())
        assertTrue(decoded.getLines(1).time.hasEnd())
        assertEquals(0, decoded.getLines(1).time.end)
    }
}
