package gondola.lyrics.model

import com.google.protobuf.UnknownFieldSet
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.makeMeta
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.runtime.Lyric
import gondola.lyrics.model.runtime.LyricStatus
import gondola.lyrics.model.runtime.canonicalizeLyric
import gondola.lyrics.model.runtime.decode
import gondola.lyrics.model.runtime.deriveLanguageUsages
import gondola.lyrics.model.runtime.encode
import gondola.lyrics.model.runtime.makeLineContentWords
import gondola.lyrics.model.runtime.makeLineInstrumental
import gondola.lyrics.model.runtime.makeLineNormal
import gondola.lyrics.model.runtime.makeLyric
import gondola.lyrics.model.runtime.makeWordNormal
import gondola.lyrics.model.runtime.makeWordSpace
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import gondola.lyrics.model.storage.decode as decodeStorage
import gondola.lyrics.model.storage.encode as encodeStorage
import gondola.lyrics.model.storage.makeLineContentText as makeStorageLineContentText
import gondola.lyrics.model.storage.makeLineNormal as makeStorageLineNormal
import gondola.lyrics.model.storage.makeLyric as makeStorageLyric

class CodecTest {
    private fun buildLyric(): Lyric {
        val lines = listOf(
            makeLineInstrumental(time = makeTimeRange(start = 0, end = 1000)),
            makeLineNormal(
                time = makeTimeRange(start = 1000, end = 2000),
                languages = listOf("en"),
                content = makeLineContentWords(
                    listOf(
                        makeWordNormal(text = "hi", language = "en", time = makeTimeRange(start = 1000, end = 1500)),
                        makeWordSpace(text = " "),
                        makeWordNormal(text = "there", language = "en", time = makeTimeRange(start = 1500, end = 2000)),
                    ),
                ),
            ),
        )
        return makeLyric(
            format = "lrc",
            timing = Timing.TIMING_WORD,
            status = LyricStatus.LYRIC_STATUS_VALID,
            languages = deriveLanguageUsages(lines),
            lines = lines,
        )
    }

    @Test
    fun roundTripsRuntimeLyric() {
        val lyric = buildLyric()
        assertEquals(lyric, decode(encode(lyric)))
    }

    @Test
    fun roundTripsStorageLyric() {
        val lyric = makeStorageLyric(
            format = "lrc",
            timing = Timing.TIMING_LINE,
            lines = listOf(
                makeStorageLineNormal(
                    time = makeTimeRange(start = 1000, end = 2000),
                    languages = listOf("en"),
                    content = makeStorageLineContentText("hi there"),
                ),
            ),
        )
        assertEquals(lyric, decodeStorage(encodeStorage(lyric)))
    }

    // A submessage holding nothing but unknown fields is the only thing standing between a round trip and silent data loss.
    @Test
    fun keepsSubmessageCarryingOnlyUnknownFields() {
        val unknown = UnknownFieldSet.newBuilder().addField(9999, UnknownFieldSet.Field.newBuilder().addVarint(1).build()).build()
        val meta = makeMeta().toBuilder().setUnknownFields(unknown).build()
        val canonical = canonicalizeLyric(buildLyric().toBuilder().setMeta(meta).build())

        assertTrue(canonical.hasMeta())
        assertEquals(unknown, decode(encode(canonical)).meta.unknownFields)
    }

    @Test
    fun dropsSubmessageThatIsEmptyForReal() {
        val canonical = canonicalizeLyric(buildLyric().toBuilder().setMeta(makeMeta()).build())
        assertFalse(canonical.hasMeta())
    }
}
