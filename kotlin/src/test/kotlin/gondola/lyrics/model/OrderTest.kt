package gondola.lyrics.model

import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.makeLanguageUsage
import gondola.lyrics.model.enriched.makeLineNormal
import gondola.lyrics.model.enriched.makeLyric
import gondola.lyrics.model.enriched.orderLanguageUsages
import gondola.lyrics.model.enriched.orderLyric
import kotlin.test.Test
import kotlin.test.assertEquals

class OrderTest {
    // A line with no range used to sort first, which told the consumer it starts at zero.
    @Test
    fun putsLinesWithNoRangeLastInOriginalOrder() {
        val lyric = makeLyric(
            format = "lrc",
            timing = Timing.TIMING_LINE,
            status = LyricStatus.LYRIC_STATUS_VALID,
            lines = listOf(
                makeLineNormal(id = "second", time = makeTimeRange(start = 2000)),
                makeLineNormal(id = "untimed-first"),
                makeLineNormal(id = "first", time = makeTimeRange(start = 1000)),
                makeLineNormal(id = "untimed-second"),
            ),
        )
        assertEquals(listOf("first", "second", "untimed-first", "untimed-second"), orderLyric(lyric).lines.map { it.id })
    }

    // Comparing tags by codepoint sorted every capitalized tag ahead of every lowercase one.
    @Test
    fun comparesLanguageTagsWithoutCase() {
        val languages = listOf(makeLanguageUsage(tag = "Zh", count = 1), makeLanguageUsage(tag = "ja", count = 1))
        assertEquals(listOf("ja", "Zh"), orderLanguageUsages(languages).map { it.tag })
    }

    @Test
    fun ordersLanguageUsagesByDescendingCount() {
        val languages = listOf(makeLanguageUsage(tag = "en", count = 1), makeLanguageUsage(tag = "ja", count = 3))
        assertEquals(listOf("ja", "en"), orderLanguageUsages(languages).map { it.tag })
    }
}
