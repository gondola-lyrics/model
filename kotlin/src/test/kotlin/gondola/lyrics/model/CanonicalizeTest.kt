package gondola.lyrics.model

import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.PartType
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.common.makePart
import gondola.lyrics.model.common.makeText
import gondola.lyrics.model.common.makeTextToken
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.makeUnknownEntry
import gondola.lyrics.model.document.LineType
import gondola.lyrics.model.document.WordType
import gondola.lyrics.model.document.canonicalizeDocumentLyric
import gondola.lyrics.model.document.encodeDocumentLyric
import gondola.lyrics.model.document.makeDocumentLineContentText
import gondola.lyrics.model.document.makeDocumentLineNormal
import gondola.lyrics.model.document.makeDocumentLyric
import gondola.lyrics.model.enriched.LineContent
import gondola.lyrics.model.enriched.Lyric
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.WordEmphasis
import gondola.lyrics.model.enriched.canonicalizeEnrichedLineAnnotation
import gondola.lyrics.model.enriched.canonicalizeEnrichedLyric
import gondola.lyrics.model.enriched.canonicalizeEnrichedWord
import gondola.lyrics.model.enriched.canonicalizeEnrichedWordAnnotation
import gondola.lyrics.model.enriched.deriveEnrichedLanguageUsages
import gondola.lyrics.model.enriched.encodeEnrichedLyric
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotation
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRoman
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRomanContentText
import gondola.lyrics.model.enriched.makeEnrichedLineContentWords
import gondola.lyrics.model.enriched.makeEnrichedLineNormal
import gondola.lyrics.model.enriched.makeEnrichedLyric
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotation
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotationRoman
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotationRuby
import gondola.lyrics.model.enriched.makeEnrichedWordEmphasis
import gondola.lyrics.model.enriched.makeEnrichedWordNormal
import gondola.lyrics.model.enriched.validateEnrichedLyric
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import gondola.lyrics.model.document.Line as DocumentLine
import gondola.lyrics.model.document.LineContent as DocumentLineContent
import gondola.lyrics.model.document.Lyric as DocumentLyric
import gondola.lyrics.model.document.Word as DocumentWord

class CanonicalizeTest {
    private fun buildLyric(): Lyric {
        val lines = listOf(
            makeEnrichedLineNormal(
                time = makeTimeRange(start = 1000, end = 2000),
                languages = listOf("EN"),
                part = makePart(type = PartType.PART_TYPE_VERSE, id = "Verse-A", raw = "Verse 1"),
                content = makeEnrichedLineContentWords(
                    listOf(
                        makeEnrichedWordNormal(
                            text = "hi",
                            language = "EN",
                            time = makeTimeRange(start = 1000, end = 2000),
                            emphasis = makeEnrichedWordEmphasis(value = true),
                        ),
                    ),
                ),
            ),
        )
        return makeEnrichedLyric(
            format = "TTML",
            profile = "AMLL",
            timing = TimingLevel.TIMING_LEVEL_WORD,
            status = LyricStatus.LYRIC_STATUS_VALID,
            languages = deriveEnrichedLanguageUsages(lines),
            lines = lines,
        )
    }

    @Test
    fun lowercasesFormatProfileAndTags() {
        val lyric = buildLyric()
        val canonical = canonicalizeEnrichedLyric(lyric)
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
        val once = canonicalizeEnrichedLyric(buildLyric())
        assertEquals(once, canonicalizeEnrichedLyric(once))
    }

    @Test
    fun preservesExplicitEmphasisDecisionsAndOriginWhileDroppingEmptyEmphasis() {
        val emphases = listOf(
            makeEnrichedWordEmphasis(),
            makeEnrichedWordEmphasis(value = false),
            makeEnrichedWordEmphasis(value = true),
            makeEnrichedWordEmphasis(value = false, derived = false),
            makeEnrichedWordEmphasis(value = false, derived = true),
            makeEnrichedWordEmphasis(value = true, derived = false),
            makeEnrichedWordEmphasis(value = true, derived = true),
        )
        val canonical = emphases.map { canonicalizeEnrichedWord(makeEnrichedWordNormal(text = "ah", emphasis = it)).emphasis }
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
            val word = makeEnrichedWordAnnotation(
                romans = listOf(
                    makeEnrichedWordAnnotationRoman(
                        language = "JA-Latn",
                        scheme = scheme,
                        tokens = listOf(makeTextToken(text = "shi")),
                    ),
                ),
                rubies = listOf(
                    makeEnrichedWordAnnotationRuby(
                        language = "JA-Latn",
                        scheme = scheme,
                        tokens = listOf(makeTextToken(text = "shi")),
                    ),
                ),
            )
            val line =
                makeEnrichedLineAnnotation(
                    romans = listOf(
                        makeEnrichedLineAnnotationRoman(
                            language = "JA-Latn",
                            scheme = scheme,
                            content = makeEnrichedLineAnnotationRomanContentText("shi"),
                        ),
                    ),
                )
            val canonicalWord = canonicalizeEnrichedWordAnnotation(word)
            val canonicalLine = canonicalizeEnrichedLineAnnotation(line)
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
        val token = makeTextToken(time = wordTime, text = "shi")
        val word = gondola.lyrics.model.document.makeDocumentWordNormal(
            text = "x",
            time = wordTime,
            emphasis = false,
            annotation = gondola.lyrics.model.document.makeDocumentWordAnnotation(
                romans = listOf(
                    gondola.lyrics.model.document.makeDocumentWordAnnotationRoman(
                        language = "JA-Latn",
                        scheme = "HEPBURN",
                        tokens = listOf(token),
                    ),
                    gondola.lyrics.model.document.makeDocumentWordAnnotationRoman(),
                ),
            ),
        )
        val canonical = gondola.lyrics.model.document.canonicalizeDocumentWord(word)
        val roman = assertNotNull(canonical.annotation).romans.single()

        assertEquals("ja-latn", roman.language)
        assertEquals("hepburn", roman.scheme)
        assertEquals(listOf(token), roman.tokens)
        assertEquals(false, canonical.emphasis)
        assertEquals(wordTime, gondola.lyrics.model.document.resolveDocumentAnnotationTokenTime(token, roman, canonical))
        assertEquals("JA-Latn", assertNotNull(word.annotation).romans[0].language)
        assertEquals(2, word.annotation.romans.size)
        assertEquals(emptyList(), gondola.lyrics.model.document.validateDocumentWord(canonical, timing = TimingLevel.TIMING_LEVEL_WORD))
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
        val original = encodeEnrichedLyric(lyric)
        val originalDocument = encodeDocumentLyric(stored)

        val canonical = canonicalizeEnrichedLyric(lyric)
        val canonicalDocument = canonicalizeDocumentLyric(stored)
        assertContentEquals(original, encodeEnrichedLyric(lyric))
        assertContentEquals(originalDocument, encodeDocumentLyric(stored))
        val snapshot = encodeEnrichedLyric(canonical)
        val documentSnapshot = encodeDocumentLyric(canonicalDocument)

        words.clear()
        documentWords.clear()
        tags.clear()
        agents.clear()
        extra["key"] = "changed"
        titles.clear()
        unknowns.clear()
        lines.clear()
        documentLines.clear()

        assertContentEquals(snapshot, encodeEnrichedLyric(canonical))
        assertContentEquals(documentSnapshot, encodeDocumentLyric(canonicalDocument))
    }

    @Test
    fun leavesCanonicalLyricValid() {
        assertEquals(emptyList(), validateEnrichedLyric(canonicalizeEnrichedLyric(buildLyric())))
    }
}
