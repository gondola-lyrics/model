package gondola.lyrics.model

import gondola.lyrics.model.common.PartType
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.common.makePart
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.document.canonicalizeDocumentLine
import gondola.lyrics.model.document.canonicalizeDocumentLyric
import gondola.lyrics.model.document.makeDocumentLineBackground
import gondola.lyrics.model.document.makeDocumentLineContentText
import gondola.lyrics.model.document.makeDocumentLineNormal
import gondola.lyrics.model.document.makeDocumentLyric
import gondola.lyrics.model.document.orderDocumentLine
import gondola.lyrics.model.document.orderDocumentLyric
import gondola.lyrics.model.document.validateDocumentLyric
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.canonicalizeEnrichedLine
import gondola.lyrics.model.enriched.canonicalizeEnrichedLyric
import gondola.lyrics.model.enriched.makeEnrichedLanguageUsage
import gondola.lyrics.model.enriched.makeEnrichedLineBackground
import gondola.lyrics.model.enriched.makeEnrichedLineContentText
import gondola.lyrics.model.enriched.makeEnrichedLineNormal
import gondola.lyrics.model.enriched.makeEnrichedLyric
import gondola.lyrics.model.enriched.orderEnrichedLanguageUsages
import gondola.lyrics.model.enriched.orderEnrichedLine
import gondola.lyrics.model.enriched.orderEnrichedLyric
import gondola.lyrics.model.enriched.validateEnrichedLyric
import kotlin.test.Test
import kotlin.test.assertEquals

class OrderTest {
    @Test
    fun preservesContiguousPartsWithEqualStartsInBothLayers() {
        val verse = makePart(type = PartType.PART_TYPE_VERSE, id = "verse")
        val chorus = makePart(type = PartType.PART_TYPE_CHORUS, id = "chorus")
        val sections = listOf(Triple("a1", verse, 1000L), Triple("a2", verse, 3000L), Triple("b1", chorus, 2000L))
        val document = makeDocumentLyric(
            timing = TimingLevel.TIMING_LEVEL_LINE,
            lines = sections.map { (id, part, end) ->
                makeDocumentLineNormal(id = id, part = part, time = makeTimeRange(start = 0, end = end), content = makeDocumentLineContentText(id))
            },
        )
        val enriched = makeEnrichedLyric(
            status = LyricStatus.LYRIC_STATUS_VALID,
            timing = TimingLevel.TIMING_LEVEL_LINE,
            lines = sections.map { (id, part, end) ->
                makeEnrichedLineNormal(id = id, part = part, time = makeTimeRange(start = 0, end = end), content = makeEnrichedLineContentText(id))
            },
        )
        val expected = listOf("a1", "a2", "b1")
        assertEquals(emptyList(), validateDocumentLyric(document))
        assertEquals(emptyList(), validateEnrichedLyric(enriched))

        for (transform in listOf(::orderDocumentLyric, ::canonicalizeDocumentLyric)) {
            val result = transform(document)
            assertEquals(emptyList(), validateDocumentLyric(result))
            assertEquals(expected, result.lines.map { it.id })
            assertEquals(expected, document.lines.map { it.id })
        }
        for (transform in listOf(::orderEnrichedLyric, ::canonicalizeEnrichedLyric)) {
            val result = transform(enriched)
            assertEquals(emptyList(), validateEnrichedLyric(result))
            assertEquals(expected, result.lines.map { it.id })
            assertEquals(expected, enriched.lines.map { it.id })
        }
    }

    @Test
    fun preservesEqualStartBackgroundOrderInBothLayers() {
        val ranges = listOf("long" to 800L, "short" to 300L, "empty" to 100L)
        val documentLine = makeDocumentLineNormal(
            time = makeTimeRange(start = 0, end = 1000),
            content = makeDocumentLineContentText("lead"),
            backgrounds = ranges.map { (id, end) ->
                makeDocumentLineBackground(id = id, time = makeTimeRange(start = 100, end = end), content = makeDocumentLineContentText(id))
            },
        )
        val enrichedLine = makeEnrichedLineNormal(
            time = makeTimeRange(start = 0, end = 1000),
            content = makeEnrichedLineContentText("lead"),
            backgrounds = ranges.map { (id, end) ->
                makeEnrichedLineBackground(id = id, time = makeTimeRange(start = 100, end = end), content = makeEnrichedLineContentText(id))
            },
        )
        val document = makeDocumentLyric(timing = TimingLevel.TIMING_LEVEL_LINE, lines = listOf(documentLine))
        val enriched = makeEnrichedLyric(
            status = LyricStatus.LYRIC_STATUS_VALID,
            timing = TimingLevel.TIMING_LEVEL_LINE,
            lines = listOf(enrichedLine),
        )
        val expected = listOf("long", "short", "empty")
        assertEquals(emptyList(), validateDocumentLyric(document))
        assertEquals(emptyList(), validateEnrichedLyric(enriched))

        for (transform in listOf(::orderDocumentLine, ::canonicalizeDocumentLine)) {
            val result = transform(documentLine)
            assertEquals(expected, result.backgrounds.map { it.id })
            assertEquals(emptyList(), validateDocumentLyric(document.copy(lines = listOf(result))))
            assertEquals(expected, documentLine.backgrounds.map { it.id })
        }
        for (transform in listOf(::orderEnrichedLine, ::canonicalizeEnrichedLine)) {
            val result = transform(enrichedLine)
            assertEquals(expected, result.backgrounds.map { it.id })
            assertEquals(emptyList(), validateEnrichedLyric(enriched.copy(lines = listOf(result))))
            assertEquals(expected, enrichedLine.backgrounds.map { it.id })
        }
    }

    @Test
    fun ordersStartsStablyAndKeepsUnusableRangesLastInBothLayers() {
        val ranges = listOf(
            "untimed-first" to null,
            "later" to makeTimeRange(start = 2000, end = 3000),
            "reversed" to makeTimeRange(start = 500, end = 100),
            "open" to makeTimeRange(start = 1000),
            "negative" to TimeRange(start = -1),
            "closed" to makeTimeRange(start = 1000, end = 1500),
            "overflow" to makeTimeRange(start = 100, end = 2147483648L),
            "untimed-second" to null,
            "empty" to makeTimeRange(start = 1000, end = 1000),
        )
        val document = makeDocumentLyric(
            timing = TimingLevel.TIMING_LEVEL_LINE,
            lines = ranges.map { (id, time) ->
                makeDocumentLineNormal(id = id, time = time, content = makeDocumentLineContentText(id))
            },
        )
        val enriched = makeEnrichedLyric(
            timing = TimingLevel.TIMING_LEVEL_LINE,
            status = LyricStatus.LYRIC_STATUS_VALID,
            lines = ranges.map { (id, time) ->
                makeEnrichedLineNormal(id = id, time = time, content = makeEnrichedLineContentText(id))
            },
        )
        val expected = listOf("open", "closed", "empty", "later", "untimed-first", "reversed", "negative", "overflow", "untimed-second")
        val original = ranges.map { it.first }

        for (transform in listOf(::orderDocumentLyric, ::canonicalizeDocumentLyric)) {
            assertEquals(expected, transform(document).lines.map { it.id })
            assertEquals(original, document.lines.map { it.id })
        }
        for (transform in listOf(::orderEnrichedLyric, ::canonicalizeEnrichedLyric)) {
            assertEquals(expected, transform(enriched).lines.map { it.id })
            assertEquals(original, enriched.lines.map { it.id })
        }
    }

    // Comparing tags by codepoint sorted every capitalized tag ahead of every lowercase one.
    @Test
    fun comparesLanguageTagsWithoutCase() {
        val languages = listOf(makeEnrichedLanguageUsage(tag = "Zh", lineCount = 1), makeEnrichedLanguageUsage(tag = "ja", lineCount = 1))
        assertEquals(listOf("ja", "Zh"), orderEnrichedLanguageUsages(languages).map { it.tag })
    }

    @Test
    fun ordersLanguageUsagesByDescendingLineCount() {
        val languages = listOf(makeEnrichedLanguageUsage(tag = "en", lineCount = 1), makeEnrichedLanguageUsage(tag = "ja", lineCount = 3))
        assertEquals(listOf("ja", "en"), orderEnrichedLanguageUsages(languages).map { it.tag })
    }
}
