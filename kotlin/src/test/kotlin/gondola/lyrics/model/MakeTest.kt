package gondola.lyrics.model

import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.document.WordType
import gondola.lyrics.model.enriched.LineType
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.canonicalizeLine
import gondola.lyrics.model.enriched.canonicalizeWord
import gondola.lyrics.model.enriched.makeLineInstrumental
import gondola.lyrics.model.enriched.makeLineNormal
import gondola.lyrics.model.enriched.makeLyric
import gondola.lyrics.model.enriched.makeWordNormal
import kotlin.test.Test
import kotlin.test.assertEquals
import gondola.lyrics.model.document.makeWordNormal as makeDocumentWordNormal
import gondola.lyrics.model.document.makeWordSpace as makeDocumentWordSpace

class MakeTest {
    @Test
    fun stampsSchemaVersion() {
        val lyric = makeLyric(format = "lrc", timing = Timing.TIMING_NONE, status = LyricStatus.LYRIC_STATUS_VALID)
        assertEquals(SCHEMA_VERSION, lyric.version)
    }

    // The discriminant is stamped by the constructor, so a line can never claim a kind its fields do not match.
    @Test
    fun stampsLineAndWordKinds() {
        assertEquals(LineType.LINE_TYPE_NORMAL, makeLineNormal().type)
        assertEquals(LineType.LINE_TYPE_INSTRUMENTAL, makeLineInstrumental().type)
        assertEquals(WordType.WORD_TYPE_NORMAL, makeDocumentWordNormal(text = "hi").type)
        assertEquals(WordType.WORD_TYPE_SPACE, makeDocumentWordSpace(text = " ").type)
    }

    // Constructors store what they are given; canonicalizing is the only thing that rewrites a tag.
    @Test
    fun storesTagsAsGiven() {
        val word = makeWordNormal(text = "hi", language = "JA-JP")
        assertEquals("JA-JP", word.language)
        assertEquals("ja-jp", canonicalizeWord(word).language)

        val line = makeLineNormal(languages = listOf("JA-JP"))
        assertEquals(listOf("JA-JP"), line.languages)
        assertEquals(listOf("ja-jp"), canonicalizeLine(line).languages)
    }
}
