package gondola.lyrics.model

import gondola.lyrics.model.common.LineType
import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.PartType
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.WordType
import gondola.lyrics.model.common.makePart
import gondola.lyrics.model.common.makeText
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.makeUnknownEntry
import gondola.lyrics.model.runtime.LineContent
import gondola.lyrics.model.runtime.Lyric
import gondola.lyrics.model.runtime.LyricStatus
import gondola.lyrics.model.runtime.canonicalizeLyric
import gondola.lyrics.model.runtime.deriveLanguageUsages
import gondola.lyrics.model.runtime.encode
import gondola.lyrics.model.runtime.makeLineContentWords
import gondola.lyrics.model.runtime.makeLineNormal
import gondola.lyrics.model.runtime.makeLyric
import gondola.lyrics.model.runtime.makeWordEmphasis
import gondola.lyrics.model.runtime.makeWordNormal
import gondola.lyrics.model.runtime.validateLyric
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import gondola.lyrics.model.storage.Line as StorageLine
import gondola.lyrics.model.storage.LineContent as StorageLineContent
import gondola.lyrics.model.storage.Lyric as StorageLyric
import gondola.lyrics.model.storage.Word as StorageWord
import gondola.lyrics.model.storage.canonicalizeLyric as canonicalizeStorageLyric
import gondola.lyrics.model.storage.encode as encodeStorage
import gondola.lyrics.model.storage.makeLyric as makeStorageLyric

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
            format = "TTML",
            profile = "AMLL",
            timing = Timing.TIMING_WORD,
            status = LyricStatus.LYRIC_STATUS_VALID,
            languages = deriveLanguageUsages(lines),
            lines = lines,
        )
    }

    @Test
    fun lowercasesFormatProfileAndTags() {
        val canonical = canonicalizeLyric(buildLyric())
        assertEquals("ttml", canonical.format)
        assertEquals("amll", canonical.profile)
        assertEquals(listOf("en"), canonical.lines[0].languages)
        assertEquals("en", assertNotNull(canonical.lines[0].content).words[0].language)

        val persisted = canonicalizeStorageLyric(makeStorageLyric(format = "TTML", profile = "ITUNES"))
        assertEquals("ttml", persisted.format)
        assertEquals("itunes", persisted.profile)
    }

    @Test
    fun isIdempotent() {
        val once = canonicalizeLyric(buildLyric())
        assertEquals(once, canonicalizeLyric(once))
    }

    @Test
    fun keepsMutableContainersIsolatedFromBothLayers() {
        val base = buildLyric()
        val words = assertNotNull(base.lines[0].content).words.toMutableList()
        val tags = mutableListOf("EN")
        val agents = mutableListOf("a")
        val extra = linkedMapOf("key" to "value")
        val titles = mutableListOf(makeText(text = "title"))
        val unknowns = mutableListOf(makeUnknownEntry(key = "x", value = "y"))
        val meta = Meta(titles = titles, unknowns = unknowns)
        val lines = mutableListOf(base.lines[0].copy(languages = tags, agents = agents, content = LineContent(words = words)))
        val lyric = base.copy(extra = extra, meta = meta, lines = lines)
        val storageWords = mutableListOf(StorageWord(type = WordType.WORD_TYPE_NORMAL, text = "x"))
        val storageLines = mutableListOf(
            StorageLine(type = LineType.LINE_TYPE_NORMAL, languages = tags, agents = agents, content = StorageLineContent(words = storageWords)),
        )
        val stored = StorageLyric(extra = extra, meta = meta, lines = storageLines)
        val original = encode(lyric)
        val originalStorage = encodeStorage(stored)

        val canonical = canonicalizeLyric(lyric)
        val canonicalStorage = canonicalizeStorageLyric(stored)
        assertContentEquals(original, encode(lyric))
        assertContentEquals(originalStorage, encodeStorage(stored))
        val snapshot = encode(canonical)
        val storageSnapshot = encodeStorage(canonicalStorage)

        words.clear()
        storageWords.clear()
        tags.clear()
        agents.clear()
        extra["key"] = "changed"
        titles.clear()
        unknowns.clear()
        lines.clear()
        storageLines.clear()

        assertContentEquals(snapshot, encode(canonical))
        assertContentEquals(storageSnapshot, encodeStorage(canonicalStorage))
    }

    @Test
    fun leavesCanonicalLyricValid() {
        assertEquals(emptyList(), validateLyric(canonicalizeLyric(buildLyric())))
    }
}
