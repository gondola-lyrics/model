package gondola.lyrics.model

import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.common.isWellFormedLanguageTag
import gondola.lyrics.model.common.makeMeta
import gondola.lyrics.model.common.makeText
import gondola.lyrics.model.document.makeDocumentLyric
import gondola.lyrics.model.document.validateDocumentLyric
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.makeEnrichedLyric
import gondola.lyrics.model.enriched.validateEnrichedLyric
import kotlin.test.Test
import kotlin.test.assertEquals

class TagTest {
    @Test
    fun acceptsOrdinaryTagsWithoutRequiringRegisteredOrUniqueSubtags() {
        val tags = listOf(
            "en",
            "EN",
            "und",
            "qqq",
            "abcd",
            "abcde",
            "abcdefgh",
            "en-US",
            "es-419",
            "zh-Hans",
            "zh-Hans-CN",
            "zh-cmn-Hans-CN",
            "en-aaa-bbb-ccc-Latn-US",
            "de-CH-1901",
            "sl-rozaj-biske-1994",
            "en-1abc",
            "en-variant1-variant2",
            "en-u-ca-gregory",
            "EN-u-CA-GREGORY",
            "en-0-ab",
            "en-a-foo-b-bar",
            "en-a-Latn-US",
            "en-1901-1901",
            "en-a-foo-a-bar",
            "en-u-ca-gregory-ca-buddhist",
        )
        for (tag in tags) {
            assertEquals(true, isWellFormedLanguageTag(tag), tag)
        }
    }

    @Test
    fun acceptsPrivateUseAndTagsLongerThan35Characters() {
        val tags = listOf(
            "x-acme",
            "X-Acme",
            "x-a",
            "x-1",
            "x-a-a",
            "x-12345678",
            "en-x-acme",
            "en-x-US-GB",
            "en-x-a-a",
            "en-x-x",
            "en-a-foo-x-a",
            "zh-Hans-CN-x-demo",
            "en-x-12345678-12345678-12345678-12345678",
        )
        for (tag in tags) {
            assertEquals(true, isWellFormedLanguageTag(tag), tag)
        }
    }

    @Test
    fun acceptsGrandfatheredTagsCaseInsensitively() {
        val tags = listOf(
            "en-GB-oed",
            "i-ami",
            "i-bnn",
            "i-default",
            "i-enochian",
            "i-hak",
            "i-klingon",
            "i-lux",
            "i-mingo",
            "i-navajo",
            "i-pwn",
            "i-tao",
            "i-tay",
            "i-tsu",
            "sgn-BE-FR",
            "sgn-BE-NL",
            "sgn-CH-DE",
            "art-lojban",
            "cel-gaulish",
            "no-bok",
            "no-nyn",
            "zh-guoyu",
            "zh-hakka",
            "zh-min",
            "zh-min-nan",
            "zh-xiang",
        )
        for (tag in tags) {
            assertEquals(true, isWellFormedLanguageTag(tag), tag)
            assertEquals(true, isWellFormedLanguageTag(tag.uppercase()), tag)
        }
    }

    @Test
    fun rejectsMalformedStructuresAndOriginalNonAsciiCharacters() {
        val tags = listOf(
            "",
            "a",
            "abcdefghi",
            "123",
            "en_US",
            " en",
            "en ",
            "en\n",
            "en\t",
            "en\r",
            "en\u0000",
            "\u212Aa",
            "en-\u0130N",
            "en-\uFF35\uFF33",
            "-en",
            "en-",
            "en--US",
            "en-abcdefghi",
            "x",
            "x-",
            "x--a",
            "x-123456789",
            "i",
            "i-test",
            "i-klingon-extra",
            "en-GB-oed-x-extra",
            "sgn-BE-FR-x-extra",
            "en-US-GB",
            "en-Latn-Hans",
            "en-US-Latn",
            "en-1901-US",
            "abcd-efg",
            "en-aaa-bbb-ccc-ddd",
            "en-12",
            "en-1ab",
            "en-a",
            "en-a-b-foo",
            "en-a-x-test",
            "en-a-1",
            "en-a-123456789",
            "en-a-foo-b",
            "en-x",
            "en-x-",
        )
        for (tag in tags) {
            assertEquals(false, isWellFormedLanguageTag(tag), tag)
        }
    }

    @Test
    fun appliesTheSameSyntaxToNestedTagsInBothLyricLayers() {
        for ((language, accepted) in listOf("x-acme" to true, "i-klingon" to true, "en-a" to false, "en-US-GB" to false)) {
            val meta = makeMeta(titles = listOf(makeText(language = language, text = "Song")))
            val document = makeDocumentLyric(timing = TimingLevel.TIMING_LEVEL_NONE, meta = meta)
            val enriched = makeEnrichedLyric(status = LyricStatus.LYRIC_STATUS_VALID, timing = TimingLevel.TIMING_LEVEL_NONE, meta = meta)
            val expected = if (accepted) emptyList() else listOf(Diagnostic("meta.titles[0].language", DiagnosticCode.LanguageTagMalformed))
            for (diagnostics in listOf(validateDocumentLyric(document), validateEnrichedLyric(enriched))) {
                assertEquals(expected, diagnostics, language)
            }
        }
    }
}
