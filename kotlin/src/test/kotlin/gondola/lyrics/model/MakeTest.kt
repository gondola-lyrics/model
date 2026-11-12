package gondola.lyrics.model

import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.document.WordType
import gondola.lyrics.model.document.makeDocumentWordNormal
import gondola.lyrics.model.document.makeDocumentWordSpace
import gondola.lyrics.model.enriched.LineType
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.canonicalizeEnrichedLine
import gondola.lyrics.model.enriched.canonicalizeEnrichedWord
import gondola.lyrics.model.enriched.makeEnrichedLineInstrumental
import gondola.lyrics.model.enriched.makeEnrichedLineNormal
import gondola.lyrics.model.enriched.makeEnrichedLyric
import gondola.lyrics.model.enriched.makeEnrichedWordNormal
import kotlin.test.Test
import kotlin.test.assertEquals

class MakeTest {
    @Test
    fun stampsSchemaVersion() {
        val lyric = makeEnrichedLyric(format = "lrc", timing = TimingLevel.TIMING_LEVEL_NONE, status = LyricStatus.LYRIC_STATUS_VALID)
        assertEquals(SCHEMA_VERSION, lyric.version)
    }

    // The discriminant is stamped by the constructor, so a line can never claim a kind its fields do not match.
    @Test
    fun stampsLineAndWordKinds() {
        assertEquals(LineType.LINE_TYPE_NORMAL, makeEnrichedLineNormal().type)
        assertEquals(LineType.LINE_TYPE_INSTRUMENTAL, makeEnrichedLineInstrumental().type)
        assertEquals(WordType.WORD_TYPE_NORMAL, makeDocumentWordNormal(text = "hi").type)
        assertEquals(WordType.WORD_TYPE_SPACE, makeDocumentWordSpace(text = " ").type)
    }

    // Constructors store what they are given; canonicalizing is the only thing that rewrites a tag.
    @Test
    fun storesTagsAsGiven() {
        val word = makeEnrichedWordNormal(text = "hi", language = "JA-JP")
        assertEquals("JA-JP", word.language)
        assertEquals("ja-jp", canonicalizeEnrichedWord(word).language)

        val line = makeEnrichedLineNormal(languages = listOf("JA-JP"))
        assertEquals(listOf("JA-JP"), line.languages)
        assertEquals(listOf("ja-jp"), canonicalizeEnrichedLine(line).languages)
    }
}
