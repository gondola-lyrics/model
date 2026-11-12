package gondola.lyrics.model

import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.makeEnrichedLanguageUsage
import gondola.lyrics.model.enriched.makeEnrichedLineNormal
import gondola.lyrics.model.enriched.makeEnrichedLyric
import gondola.lyrics.model.enriched.orderEnrichedLanguageUsages
import gondola.lyrics.model.enriched.orderEnrichedLyric
import kotlin.test.Test
import kotlin.test.assertEquals

class OrderTest {
    // A line with no range used to sort first, which told the consumer it starts at zero.
    @Test
    fun putsLinesWithNoRangeLastInOriginalOrder() {
        val lyric = makeEnrichedLyric(
            format = "lrc",
            timing = Timing.TIMING_LINE,
            status = LyricStatus.LYRIC_STATUS_VALID,
            lines = listOf(
                makeEnrichedLineNormal(id = "second", time = makeTimeRange(start = 2000)),
                makeEnrichedLineNormal(id = "untimed-first"),
                makeEnrichedLineNormal(id = "first", time = makeTimeRange(start = 1000)),
                makeEnrichedLineNormal(id = "untimed-second"),
            ),
        )
        assertEquals(listOf("first", "second", "untimed-first", "untimed-second"), orderEnrichedLyric(lyric).lines.map { it.id })
    }

    // Comparing tags by codepoint sorted every capitalized tag ahead of every lowercase one.
    @Test
    fun comparesLanguageTagsWithoutCase() {
        val languages = listOf(makeEnrichedLanguageUsage(tag = "Zh", count = 1), makeEnrichedLanguageUsage(tag = "ja", count = 1))
        assertEquals(listOf("ja", "Zh"), orderEnrichedLanguageUsages(languages).map { it.tag })
    }

    @Test
    fun ordersLanguageUsagesByDescendingCount() {
        val languages = listOf(makeEnrichedLanguageUsage(tag = "en", count = 1), makeEnrichedLanguageUsage(tag = "ja", count = 3))
        assertEquals(listOf("ja", "en"), orderEnrichedLanguageUsages(languages).map { it.tag })
    }
}
