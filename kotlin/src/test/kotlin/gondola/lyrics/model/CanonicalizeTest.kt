package gondola.lyrics.model

import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.PartType
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.makePart
import gondola.lyrics.model.common.makeText
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.makeUnknownEntry
import gondola.lyrics.model.document.LineType
import gondola.lyrics.model.document.WordType
import gondola.lyrics.model.enriched.LineContent
import gondola.lyrics.model.enriched.Lyric
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.WordEmphasis
import gondola.lyrics.model.enriched.canonicalizeLineAnnotation
import gondola.lyrics.model.enriched.canonicalizeLyric
import gondola.lyrics.model.enriched.canonicalizeWord
import gondola.lyrics.model.enriched.canonicalizeWordAnnotation
import gondola.lyrics.model.enriched.deriveLanguageUsages
import gondola.lyrics.model.enriched.encode
import gondola.lyrics.model.enriched.makeLineAnnotation
import gondola.lyrics.model.enriched.makeLineAnnotationRoman
import gondola.lyrics.model.enriched.makeLineContentWords
import gondola.lyrics.model.enriched.makeLineNormal
import gondola.lyrics.model.enriched.makeLyric
import gondola.lyrics.model.enriched.makeWordAnnotation
import gondola.lyrics.model.enriched.makeWordAnnotationRoman
import gondola.lyrics.model.enriched.makeWordAnnotationRuby
import gondola.lyrics.model.enriched.makeWordAnnotationToken
import gondola.lyrics.model.enriched.makeWordEmphasis
import gondola.lyrics.model.enriched.makeWordNormal
import gondola.lyrics.model.enriched.validateLyric
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import gondola.lyrics.model.document.Line as DocumentLine
import gondola.lyrics.model.document.LineContent as DocumentLineContent
import gondola.lyrics.model.document.Lyric as DocumentLyric
import gondola.lyrics.model.document.Word as DocumentWord
import gondola.lyrics.model.document.canonicalizeLyric as canonicalizeDocumentLyric
import gondola.lyrics.model.document.encode as encodeDocument
import gondola.lyrics.model.document.makeLineContentText as makeDocumentLineContentText
import gondola.lyrics.model.document.makeLineNormal as makeDocumentLineNormal
import gondola.lyrics.model.document.makeLyric as makeDocumentLyric

class CanonicalizeTest {
    private fun buildLyric(): Lyric {
        val lines = listOf(
            makeLineNormal(
                time = makeTimeRange(start = 1000, end = 2000),
                languages = listOf("EN"),
                part = makePart(type = PartType.PART_TYPE_VERSE, id = "Verse-A", raw = "Verse 1"),
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
        val lyric = buildLyric()
        val canonical = canonicalizeLyric(lyric)
        assertEquals("ttml", canonical.format)
        assertEquals("amll", canonical.profile)
        assertEquals(listOf("en"), canonical.lines[0].languages)
        assertEquals("en", assertNotNull(canonical.lines[0].content).words[0].language)
        assertEquals("Verse-A", canonical.lines[0].part?.id)

        val persisted = canonicalizeDocumentLyric(
            makeDocumentLyric(
                format = "TTML",
                profile = "ITUNES",
                lines = listOf(makeDocumentLineNormal(part = lyric.lines[0].part, content = makeDocumentLineContentText("hi"))),
            ),
        )
        assertEquals("ttml", persisted.format)
        assertEquals("itunes", persisted.profile)
        assertEquals("Verse-A", persisted.lines[0].part?.id)
    }

    @Test
    fun isIdempotent() {
        val once = canonicalizeLyric(buildLyric())
        assertEquals(once, canonicalizeLyric(once))
    }

    @Test
    fun preservesExplicitEmphasisDecisionsAndOriginWhileDroppingEmptyEmphasis() {
        val emphases = listOf(
            makeWordEmphasis(),
            makeWordEmphasis(value = false),
            makeWordEmphasis(value = true),
            makeWordEmphasis(value = false, derived = false),
            makeWordEmphasis(value = false, derived = true),
            makeWordEmphasis(value = true, derived = false),
            makeWordEmphasis(value = true, derived = true),
        )
        val canonical = emphases.map { canonicalizeWord(makeWordNormal(text = "ah", emphasis = it)).emphasis }
        assertEquals(
            listOf(
                null,
                WordEmphasis(value = false),
                WordEmphasis(value = true),
                WordEmphasis(value = false, derived = false),
                WordEmphasis(value = false, derived = true),
                WordEmphasis(value = true, derived = false),
                WordEmphasis(value = true, derived = true),
            ),
            canonical,
        )
    }

    @Test
    fun canonicalizesAnnotationSchemesWhilePreservingConstructorInput() {
        for (scheme in listOf("HEPBURN", "")) {
            val word = makeWordAnnotation(
                romans = listOf(
                    makeWordAnnotationRoman(language = "JA-Latn", scheme = scheme, tokens = listOf(makeWordAnnotationToken(text = "shi"))),
                ),
                rubies = listOf(
                    makeWordAnnotationRuby(language = "JA-Latn", scheme = scheme, tokens = listOf(makeWordAnnotationToken(text = "shi"))),
                ),
            )
            val line = makeLineAnnotation(romans = listOf(makeLineAnnotationRoman(language = "JA-Latn", scheme = scheme, text = "shi")))
            val canonicalWord = canonicalizeWordAnnotation(word)
            val canonicalLine = canonicalizeLineAnnotation(line)
            val expectedScheme = if (scheme.isEmpty()) null else "hepburn"
            assertEquals(
                List(3) { "ja-latn" to expectedScheme },
                listOf(
                    canonicalWord.romans[0].language to canonicalWord.romans[0].scheme,
                    canonicalWord.rubies[0].language to canonicalWord.rubies[0].scheme,
                    canonicalLine.romans[0].language to canonicalLine.romans[0].scheme,
                ),
            )
            assertEquals(
                List(3) { "JA-Latn" to scheme },
                listOf(
                    word.romans[0].language to word.romans[0].scheme,
                    word.rubies[0].language to word.rubies[0].scheme,
                    line.romans[0].language to line.romans[0].scheme,
                ),
            )
        }
    }

    @Test
    fun canonicalizesDocumentAnnotationsWithoutLosingTimingOrExplicitFalse() {
        val wordTime = makeTimeRange(start = 1000, end = 2000)
        val token = gondola.lyrics.model.document.makeWordAnnotationToken(time = wordTime, text = "shi")
        val word = gondola.lyrics.model.document.makeWordNormal(
            text = "x",
            time = wordTime,
            emphasis = false,
            annotation = gondola.lyrics.model.document.makeWordAnnotation(
                romans = listOf(
                    gondola.lyrics.model.document.makeWordAnnotationRoman(
                        language = "JA-Latn",
                        scheme = "HEPBURN",
                        tokens = listOf(token),
                    ),
                    gondola.lyrics.model.document.makeWordAnnotationRoman(),
                ),
            ),
        )
        val canonical = gondola.lyrics.model.document.canonicalizeWord(word)
        val roman = assertNotNull(canonical.annotation).romans.single()

        assertEquals("ja-latn", roman.language)
        assertEquals("hepburn", roman.scheme)
        assertEquals(listOf(token), roman.tokens)
        assertEquals(false, canonical.emphasis)
        assertEquals(wordTime, gondola.lyrics.model.document.resolveAnnotationTokenTime(token, roman, canonical))
        assertEquals("JA-Latn", assertNotNull(word.annotation).romans[0].language)
        assertEquals(2, word.annotation.romans.size)
        assertEquals(emptyList(), gondola.lyrics.model.document.validateWord(canonical, timing = Timing.TIMING_WORD))
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
        val documentWords = mutableListOf(DocumentWord(type = WordType.WORD_TYPE_NORMAL, text = "x"))
        val documentLines = mutableListOf(
            DocumentLine(type = LineType.LINE_TYPE_NORMAL, languages = tags, agents = agents, content = DocumentLineContent(words = documentWords)),
        )
        val stored = DocumentLyric(extra = extra, meta = meta, lines = documentLines)
        val original = encode(lyric)
        val originalDocument = encodeDocument(stored)

        val canonical = canonicalizeLyric(lyric)
        val canonicalDocument = canonicalizeDocumentLyric(stored)
        assertContentEquals(original, encode(lyric))
        assertContentEquals(originalDocument, encodeDocument(stored))
        val snapshot = encode(canonical)
        val documentSnapshot = encodeDocument(canonicalDocument)

        words.clear()
        documentWords.clear()
        tags.clear()
        agents.clear()
        extra["key"] = "changed"
        titles.clear()
        unknowns.clear()
        lines.clear()
        documentLines.clear()

        assertContentEquals(snapshot, encode(canonical))
        assertContentEquals(documentSnapshot, encodeDocument(canonicalDocument))
    }

    @Test
    fun leavesCanonicalLyricValid() {
        assertEquals(emptyList(), validateLyric(canonicalizeLyric(buildLyric())))
    }
}
