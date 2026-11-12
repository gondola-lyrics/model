package gondola.lyrics.model

import gondola.lyrics.model.common.canonicalizeTextToken
import gondola.lyrics.model.common.makeTextToken
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.validateTextToken
import gondola.lyrics.model.document.canonicalizeDocumentLineAnnotationRoman
import gondola.lyrics.model.document.canonicalizeDocumentWordAnnotation
import gondola.lyrics.model.document.makeDocumentLineAnnotationRoman
import gondola.lyrics.model.document.makeDocumentLineAnnotationRomanContentTokens
import gondola.lyrics.model.document.makeDocumentWordAnnotation
import gondola.lyrics.model.document.makeDocumentWordAnnotationRoman
import gondola.lyrics.model.document.makeDocumentWordAnnotationRuby
import gondola.lyrics.model.document.validateDocumentLineAnnotationRoman
import gondola.lyrics.model.document.validateDocumentWordAnnotation
import gondola.lyrics.model.enriched.canonicalizeEnrichedLineAnnotationRoman
import gondola.lyrics.model.enriched.canonicalizeEnrichedWordAnnotation
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRoman
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRomanContentTokens
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotation
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotationRoman
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotationRuby
import gondola.lyrics.model.enriched.validateEnrichedLineAnnotationRoman
import gondola.lyrics.model.enriched.validateEnrichedWordAnnotation
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotSame

class TextTokenTest {
    @Test
    fun validatesExtensionKeysThroughSharedAndContainingHelpers() {
        val token = makeTextToken(text = "ni", time = makeTimeRange(start = 1000, end = 1800), extra = mapOf("" to "value"))
        assertEquals(listOf("token.extra" to "text.token.extra.key.empty"), validateTextToken(token, "token").map { it.path to it.code.value })
        val documentWord = makeDocumentWordAnnotation(
            romans = listOf(makeDocumentWordAnnotationRoman(tokens = listOf(token))),
            rubies = listOf(makeDocumentWordAnnotationRuby(tokens = listOf(token))),
        )
        val enrichedWord = makeEnrichedWordAnnotation(
            romans = listOf(makeEnrichedWordAnnotationRoman(tokens = listOf(token))),
            rubies = listOf(makeEnrichedWordAnnotationRuby(tokens = listOf(token))),
        )
        val expectedWords = listOf(
            "rubies[0].tokens[0].extra" to "text.token.extra.key.empty",
            "romans[0].tokens[0].extra" to "text.token.extra.key.empty",
        )
        assertEquals(expectedWords, validateDocumentWordAnnotation(documentWord).map { it.path to it.code.value })
        assertEquals(expectedWords, validateEnrichedWordAnnotation(enrichedWord).map { it.path to it.code.value })
        val documentLine = makeDocumentLineAnnotationRoman(content = makeDocumentLineAnnotationRomanContentTokens(listOf(token)))
        val enrichedLine = makeEnrichedLineAnnotationRoman(content = makeEnrichedLineAnnotationRomanContentTokens(listOf(token)))
        val expectedLine = listOf("content.tokens[0].extra" to "text.token.extra.key.empty")
        assertEquals(expectedLine, validateDocumentLineAnnotationRoman(documentLine).map { it.path to it.code.value })
        assertEquals(expectedLine, validateEnrichedLineAnnotationRoman(enrichedLine).map { it.path to it.code.value })
        assertEquals(emptyList(), validateTextToken(makeTextToken(extra = mapOf(" " to "", "Unknown" to "", "unknown" to "value"))))
        assertEquals(
            listOf("token.time" to "time.range.end.before_start"),
            validateTextToken(makeTextToken(time = makeTimeRange(start = 2000, end = 1000)), "token").map { it.path to it.code.value },
        )
    }

    @Test
    fun copiesTimingAndExtensionsThroughEveryTokenContainer() {
        val extra = linkedMapOf(
            "ttml:style-ref" to "style-1",
            "Case" to "",
            "case" to "lower",
            "time" to "metadata",
            "text" to "metadata",
            "__proto__" to "kept",
        )
        val token = makeTextToken(time = makeTimeRange(start = 1000), text = " ni ", extra = extra)
        val documentWord = canonicalizeDocumentWordAnnotation(
            makeDocumentWordAnnotation(
                romans = listOf(makeDocumentWordAnnotationRoman(tokens = listOf(token))),
                rubies = listOf(makeDocumentWordAnnotationRuby(tokens = listOf(token))),
            ),
        )
        val enrichedWord = canonicalizeEnrichedWordAnnotation(
            makeEnrichedWordAnnotation(
                romans = listOf(makeEnrichedWordAnnotationRoman(tokens = listOf(token))),
                rubies = listOf(makeEnrichedWordAnnotationRuby(tokens = listOf(token))),
            ),
        )
        val documentLine =
            canonicalizeDocumentLineAnnotationRoman(
                makeDocumentLineAnnotationRoman(content = makeDocumentLineAnnotationRomanContentTokens(listOf(token))),
            )
        val enrichedLine =
            canonicalizeEnrichedLineAnnotationRoman(
                makeEnrichedLineAnnotationRoman(content = makeEnrichedLineAnnotationRomanContentTokens(listOf(token))),
            )
        val canonical = listOf(
            canonicalizeTextToken(token),
            documentWord.romans.single().tokens.single(),
            documentWord.rubies.single().tokens.single(),
            enrichedWord.romans.single().tokens.single(),
            enrichedWord.rubies.single().tokens.single(),
            documentLine.content!!.tokens.single(),
            enrichedLine.content!!.tokens.single(),
        )
        canonical.forEach { copy ->
            assertEquals(token, copy)
            assertNotSame(token, copy)
            assertNotSame(token.time, copy.time)
            assertNotSame(extra, copy.extra)
        }
        val expected = extra.toMap()
        extra["Case"] = "changed"
        extra["new"] = "added"
        canonical.forEach { copy ->
            assertEquals(expected, copy.extra)
            assertEquals(makeTimeRange(start = 1000), copy.time)
            assertEquals(" ni ", copy.text)
        }
    }

    @Test
    fun preservesExtensionOnlyTokensAndContainerContentContracts() {
        val token = makeTextToken(extra = mapOf("source" to ""))
        val tokens = listOf(makeTextToken(), token)
        val documentWord =
            canonicalizeDocumentWordAnnotation(makeDocumentWordAnnotation(romans = listOf(makeDocumentWordAnnotationRoman(tokens = tokens))))
        val enrichedWord =
            canonicalizeEnrichedWordAnnotation(makeEnrichedWordAnnotation(romans = listOf(makeEnrichedWordAnnotationRoman(tokens = tokens))))
        assertEquals(listOf(token), documentWord.romans.single().tokens)
        assertEquals(listOf(token), enrichedWord.romans.single().tokens)
        assertEquals(emptyList(), validateDocumentWordAnnotation(documentWord))
        assertEquals(emptyList(), validateEnrichedWordAnnotation(enrichedWord))
        val documentLine =
            canonicalizeDocumentLineAnnotationRoman(makeDocumentLineAnnotationRoman(content = makeDocumentLineAnnotationRomanContentTokens(tokens)))
        val enrichedLine =
            canonicalizeEnrichedLineAnnotationRoman(makeEnrichedLineAnnotationRoman(content = makeEnrichedLineAnnotationRomanContentTokens(tokens)))
        assertEquals(listOf(token), documentLine.content!!.tokens)
        assertEquals(listOf(token), enrichedLine.content!!.tokens)
        val expected = listOf(
            "content.tokens" to "line.annotation.roman.content.tokens.time.missing",
            "content.tokens[0].text" to "line.annotation.roman.token.text.empty",
        )
        assertEquals(expected, validateDocumentLineAnnotationRoman(documentLine).map { it.path to it.code.value })
        assertEquals(expected, validateEnrichedLineAnnotationRoman(enrichedLine).map { it.path to it.code.value })
        val metadataTime = makeTextToken(text = "ni", extra = mapOf("time" to "1000", "text" to "other"))
        assertEquals(emptyList(), validateTextToken(metadataTime))
        val diagnostics = validateDocumentLineAnnotationRoman(
            makeDocumentLineAnnotationRoman(content = makeDocumentLineAnnotationRomanContentTokens(listOf(metadataTime))),
        )
        assertEquals(
            listOf("content.tokens" to "line.annotation.roman.content.tokens.time.missing"),
            diagnostics.map { it.path to it.code.value },
        )
    }
}
