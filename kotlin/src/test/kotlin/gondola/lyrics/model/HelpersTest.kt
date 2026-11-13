package gondola.lyrics.model

import gondola.lyrics.model.common.AgentType
import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.DiagnosticCode
import gondola.lyrics.model.common.LineRomanView
import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.SchemePreference
import gondola.lyrics.model.common.Text
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.common.getTimeRangeDuration
import gondola.lyrics.model.common.makeAgent
import gondola.lyrics.model.common.makeText
import gondola.lyrics.model.common.makeTextToken
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.pickItemByLanguage
import gondola.lyrics.model.common.pickItemByScheme
import gondola.lyrics.model.common.resolveDiagnosticPath
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.document.makeDocumentLineAnnotationRoman
import gondola.lyrics.model.document.makeDocumentLineAnnotationRomanContentText
import gondola.lyrics.model.document.makeDocumentLineAnnotationTranslation
import gondola.lyrics.model.document.makeDocumentLineContentText
import gondola.lyrics.model.document.makeDocumentWordAnnotationRoman
import gondola.lyrics.model.document.makeDocumentWordAnnotationRuby
import gondola.lyrics.model.document.makeDocumentWordAnnotationTranslation
import gondola.lyrics.model.document.makeDocumentWordNormal
import gondola.lyrics.model.document.pickDocumentItemByLanguage
import gondola.lyrics.model.document.validateDocumentLineContent
import gondola.lyrics.model.document.validateDocumentWords
import gondola.lyrics.model.enriched.Line
import gondola.lyrics.model.enriched.LineContent
import gondola.lyrics.model.enriched.Lyric
import gondola.lyrics.model.enriched.Word
import gondola.lyrics.model.enriched.WordType
import gondola.lyrics.model.enriched.deriveEnrichedLineRomanViews
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRoman
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRomanContentText
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationTranslation
import gondola.lyrics.model.enriched.makeEnrichedLineContentText
import gondola.lyrics.model.enriched.makeEnrichedLineContentWords
import gondola.lyrics.model.enriched.makeEnrichedLineNormal
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotation
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotationRoman
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotationRuby
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotationTranslation
import gondola.lyrics.model.enriched.makeEnrichedWordNormal
import gondola.lyrics.model.enriched.makeEnrichedWordSpace
import gondola.lyrics.model.enriched.pickEnrichedItemByLanguage
import gondola.lyrics.model.enriched.resolveEnrichedLineAgents
import gondola.lyrics.model.enriched.resolveEnrichedLineLanguages
import gondola.lyrics.model.enriched.validateEnrichedLineContent
import gondola.lyrics.model.enriched.validateEnrichedWord
import gondola.lyrics.model.enriched.validateEnrichedWords
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertSame

class HelpersTest {
    @Test
    fun selectsCaseInsensitiveSchemesAndKeepsOriginalRomanOrRubyItemsInBothLayers() {
        val time = makeTimeRange(start = 1000, end = 2000)
        val tokens = listOf(makeTextToken(text = "shi", time = time, extra = mapOf("source" to "kept")))
        val language = "ja-Latn"
        fun <T> check(make: (String) -> T, languageOf: (T) -> String?, schemeOf: (T) -> String?) {
            val items = listOf(make("kunrei"), make("HePbUrN"), make("hepburn"))
            val preference = SchemePreference(scheme = "HEPBURN", languages = listOf("ja-Latn"))
            assertSame(items[1], pickItemByScheme(items, preference, languageOf, schemeOf))
            assertSame(items[1], pickItemByScheme(items, SchemePreference(scheme = "hepburn", languages = "JA-latn"), languageOf, schemeOf))
        }
        check(
            {
                makeDocumentLineAnnotationRoman(
                    language = language,
                    scheme = it,
                    time = time,
                    content = makeDocumentLineAnnotationRomanContentText("shi"),
                )
            },
            { it.language },
            { it.scheme },
        )
        check(
            {
                makeEnrichedLineAnnotationRoman(
                    language = language,
                    scheme = it,
                    time = time,
                    content = makeEnrichedLineAnnotationRomanContentText("shi"),
                )
            },
            { it.language },
            { it.scheme },
        )
        check({ makeDocumentWordAnnotationRoman(language = language, scheme = it, time = time, tokens = tokens) }, { it.language }, { it.scheme })
        check({ makeEnrichedWordAnnotationRoman(language = language, scheme = it, time = time, tokens = tokens) }, { it.language }, { it.scheme })
        check({ makeDocumentWordAnnotationRuby(language = language, scheme = it, time = time, tokens = tokens) }, { it.language }, { it.scheme })
        check({ makeEnrichedWordAnnotationRuby(language = language, scheme = it, time = time, tokens = tokens) }, { it.language }, { it.scheme })
    }

    @Test
    fun distinguishesUnrestrictedAndEmptySchemesWithOrderedLanguagePreferences() {
        val other = makeDocumentWordAnnotationRoman(language = "ja-Latn", scheme = "kunrei")
        val unspecified = makeDocumentWordAnnotationRoman(language = "ja-Latn")
        val empty = makeDocumentWordAnnotationRoman(language = "ja-Latn", scheme = "")
        val japanese = makeDocumentWordAnnotationRoman(language = "ja-Latn", scheme = "hepburn")
        val english = makeDocumentWordAnnotationRoman(language = "en", scheme = "hepburn")
        val defaultItem = makeDocumentWordAnnotationRoman(scheme = "hepburn")
        val items = listOf(other, unspecified, empty, japanese, english, defaultItem)
        fun select(preference: SchemePreference) = pickItemByScheme(items, preference, { it.language }, { it.scheme })

        assertSame(other, select(SchemePreference(languages = "ja-Latn")))
        assertSame(other, select(SchemePreference(scheme = null, languages = "ja-Latn")))
        assertSame(unspecified, select(SchemePreference(scheme = "", languages = "ja-Latn")))
        assertSame(
            empty,
            pickItemByScheme(listOf(empty, unspecified), SchemePreference(scheme = "", languages = "ja-Latn"), {
                it.language
            }, { it.scheme }),
        )
        assertSame(english, select(SchemePreference(scheme = "hepburn", languages = listOf("zh", "en"))))
        assertSame(japanese, select(SchemePreference(scheme = "hepburn", languages = listOf("ja", "en"))))
        assertSame(english, select(SchemePreference(scheme = "hepburn", languages = listOf("", "en"))))
        assertSame(defaultItem, select(SchemePreference(scheme = "hepburn")))
        assertSame(defaultItem, pickItemByScheme(items, languageOf = { it.language }, schemeOf = { it.scheme }))
    }

    @Test
    fun keepsDefaultAndFirstItemFallbackInsideTheExactSchemeFilter() {
        val other = makeDocumentWordAnnotationRoman(language = "fr", scheme = "kunrei")
        val selected = makeDocumentWordAnnotationRoman(language = "en", scheme = "hepburn")
        val defaultItem = makeDocumentWordAnnotationRoman(scheme = "hepburn")
        val items = listOf(other, selected)
        fun select(preference: SchemePreference) = pickItemByScheme(items, preference, { it.language }, { it.scheme })

        assertNull(select(SchemePreference(scheme = "hepburn", languages = "fr")))
        assertSame(selected, select(SchemePreference(scheme = "hepburn", languages = "fr", fallback = true)))
        assertSame(
            defaultItem,
            pickItemByScheme(items + defaultItem, SchemePreference(scheme = "hepburn", languages = "fr", fallback = true), {
                it.language
            }, { it.scheme }),
        )
        for (scheme in listOf("missing", "hepb", " hepburn ", "")) {
            assertNull(select(SchemePreference(scheme = scheme, languages = "en", fallback = true)))
        }
        assertNull(select(SchemePreference(scheme = "hepburn")))
        assertSame(selected, select(SchemePreference(scheme = "hepburn", fallback = true)))
        assertNull(pickItemByScheme(emptyList<Text>(), SchemePreference(scheme = "hepburn", fallback = true), { it.language }, { null }))
    }

    @Test
    fun triesOrderedLanguagePreferencesBeforeFallingBackToAnUntaggedEntry() {
        val defaultItem = makeText(text = "Default")
        val english = makeText(language = "en", text = "English")
        val chinese = makeText(language = "zh-TW", text = "Chinese")
        val items = listOf(defaultItem, english)
        val preferences = listOf("zh", "en")
        val snapshot = items.toList()

        assertSame(english, pickItemByLanguage(items, preferences))
        assertSame(english, pickItemByLanguage(items, listOf("", "zh", "EN")))
        assertSame(chinese, pickItemByLanguage(items + chinese, listOf("zh", "en")))
        assertSame(english, pickItemByLanguage(items + chinese, listOf("en", "zh")))
        assertEquals(snapshot, items)
        assertEquals(listOf("zh", "en"), preferences)

        val genericItems = listOf("default" to null, "english" to "en", "chinese" to "zh-TW")
        assertSame(genericItems[1], pickItemByLanguage(genericItems, listOf("fr", "EN")) { it.second })
        assertSame(genericItems[2], pickItemByLanguage(genericItems, listOf("zh", "en")) { it.second })
        assertSame(genericItems[1], pickItemByLanguage(genericItems, "EN") { it.second })
    }

    @Test
    fun appliesOrderedLanguagePreferencesToEveryTypedWrapperInBothLayers() {
        val preferences = listOf("", "zh", "EN")
        val earlyPreference = listOf("en", "fr")
        val unmatched = listOf("zh", "de")
        fun <T> check(make: (String?) -> T, select: (List<T>, List<String>, Boolean) -> T?, selectSingle: (List<T>, String?) -> T?) {
            val untagged = make(null)
            val regional = make("en-US")
            val exact = make("EN")
            val tied = make("en")
            val french = make("fr")
            val emptyLanguage = make("")
            val items = listOf(untagged, regional, exact, tied, french)

            assertSame(exact, select(items, preferences, false))
            assertSame(exact, select(items, listOf("en"), false))
            assertSame(exact, selectSingle(items, "en"))
            assertSame(regional, select(listOf(regional, french), earlyPreference, false))
            assertSame(untagged, select(items, unmatched, true))
            assertSame(emptyLanguage, select(listOf(exact, emptyLanguage), emptyList(), false))
            assertNull(select(listOf(exact), unmatched, false))
            assertSame(exact, select(listOf(exact), unmatched, true))
            assertNull(select(emptyList(), preferences, true))
            assertSame(untagged, selectSingle(items, null))
            assertEquals(listOf(untagged, regional, exact, tied, french), items)
        }
        check({ makeDocumentLineAnnotationRoman(language = it) }, ::pickDocumentItemByLanguage) { items, wanted ->
            pickDocumentItemByLanguage(items, wanted)
        }
        check({ makeDocumentLineAnnotationTranslation(language = it) }, ::pickDocumentItemByLanguage) { items, wanted ->
            pickDocumentItemByLanguage(items, wanted)
        }
        check({ makeDocumentWordAnnotationRoman(language = it) }, ::pickDocumentItemByLanguage) { items, wanted ->
            pickDocumentItemByLanguage(items, wanted)
        }
        check({ makeDocumentWordAnnotationRuby(language = it) }, ::pickDocumentItemByLanguage) { items, wanted ->
            pickDocumentItemByLanguage(items, wanted)
        }
        check({ makeDocumentWordAnnotationTranslation(language = it) }, ::pickDocumentItemByLanguage) { items, wanted ->
            pickDocumentItemByLanguage(items, wanted)
        }
        check({ makeDocumentWordNormal(language = it) }, ::pickDocumentItemByLanguage) { items, wanted ->
            pickDocumentItemByLanguage(items, wanted)
        }
        check({ makeEnrichedLineAnnotationRoman(language = it) }, ::pickEnrichedItemByLanguage) { items, wanted ->
            pickEnrichedItemByLanguage(items, wanted)
        }
        check({ makeEnrichedLineAnnotationTranslation(language = it) }, ::pickEnrichedItemByLanguage) { items, wanted ->
            pickEnrichedItemByLanguage(items, wanted)
        }
        check({ makeEnrichedWordAnnotationRoman(language = it) }, ::pickEnrichedItemByLanguage) { items, wanted ->
            pickEnrichedItemByLanguage(items, wanted)
        }
        check({ makeEnrichedWordAnnotationRuby(language = it) }, ::pickEnrichedItemByLanguage) { items, wanted ->
            pickEnrichedItemByLanguage(items, wanted)
        }
        check({ makeEnrichedWordAnnotationTranslation(language = it) }, ::pickEnrichedItemByLanguage) { items, wanted ->
            pickEnrichedItemByLanguage(items, wanted)
        }
        check({ makeEnrichedWordNormal(language = it) }, ::pickEnrichedItemByLanguage) { items, wanted ->
            pickEnrichedItemByLanguage(items, wanted)
        }
    }

    @Test
    fun preservesSingleLanguageRankingBoundariesAndSourceOrderOnTies() {
        val english = makeText(language = "en", text = "English")
        val extended = makeText(language = "en-US-x-demo", text = "Extended")
        val regional = makeText(language = "en-US", text = "Regional")
        val tied = makeText(language = "EN-us", text = "Tied")
        val items = listOf(english, extended, regional, tied)
        for ((wanted, expected) in listOf("en" to english, "EN-us" to regional, "en-US-x-demo" to extended, "en-US-x-other" to regional)) {
            assertSame(expected, pickItemByLanguage(items, wanted))
            assertSame(expected, pickItemByLanguage(items, listOf(wanted)))
        }
        assertNull(pickItemByLanguage(listOf(makeText(language = "jav", text = "Other")), listOf("ja")))
        assertNull(pickItemByLanguage(listOf(makeText(language = "zh-CN", text = "Other")), listOf("zh-Hans")))
    }

    @Test
    fun appliesDefaultAndExplicitFirstItemFallbackAfterAllPreferencesFail() {
        val english = makeText(language = "en", text = "English")
        val emptyLanguage = makeText(language = "", text = "Default")
        val untagged = makeText(text = "Untagged")
        val items = listOf(english, emptyLanguage, untagged)
        assertSame(emptyLanguage, pickItemByLanguage(items))
        assertSame(emptyLanguage, pickItemByLanguage(items, null))
        assertSame(emptyLanguage, pickItemByLanguage(items, ""))
        for (wanted in listOf(emptyList(), listOf(""), listOf("fr", "de"))) {
            assertSame(emptyLanguage, pickItemByLanguage(items, wanted))
            assertSame(emptyLanguage, pickItemByLanguage(items, wanted, true))
        }
        assertNull(pickItemByLanguage(listOf(english), listOf("fr", "de")))
        assertSame(english, pickItemByLanguage(listOf(english), listOf("fr", "de"), true))
        assertSame(english, pickItemByLanguage(listOf(english), fallback = true))
        assertSame(english, pickItemByLanguage(listOf(english), "fr", true))
        assertNull(pickItemByLanguage(emptyList<Text>(), listOf("en"), true))
    }

    @Test
    fun resolvesLocalContentAndArrayDiagnosticsAgainstTheirActualInputs() {
        val documentContent = makeDocumentLineContentText("")
        val enrichedContent = makeEnrichedLineContentText("")
        for ((content, diagnostics) in listOf(
            documentContent to validateDocumentLineContent(documentContent, null),
            enrichedContent to validateEnrichedLineContent(enrichedContent, null),
        )) {
            assertEquals(listOf(Diagnostic("text", DiagnosticCode.LineContentTextEmpty)), diagnostics)
            assertEquals("", resolveDiagnosticPath(content, diagnostics.single().path))
        }
        val documentWords = listOf(makeDocumentWordNormal(text = "Hello"))
        val enrichedWords = listOf(makeEnrichedWordNormal(text = "Hello"))
        for ((words, diagnostics) in listOf(
            documentWords to validateDocumentWords(documentWords, null),
            enrichedWords to validateEnrichedWords(enrichedWords, null),
        )) {
            assertEquals(listOf(Diagnostic("[0]", DiagnosticCode.LineWordTimeMissing)), diagnostics)
            assertSame(words.single(), resolveDiagnosticPath(words, diagnostics.single().path))
        }
        val root = mapOf("lines" to listOf(mapOf("content" to documentContent)))
        val nested = validateDocumentLineContent(documentContent, null, "lines[0].content")
        assertEquals("lines[0].content.text", nested.single().path)
        assertEquals("", resolveDiagnosticPath(root, nested.single().path))
        val absent = validateDocumentLineContent(null, null, "lines[0].content")
        assertEquals(listOf(Diagnostic("lines[0].content", DiagnosticCode.LineContentMissing)), absent)
    }

    @Test
    fun resolvesOnlyFieldPathsAndAnOptionalRootArrayIndex() {
        val words = listOf(makeEnrichedWordNormal(text = "Hello", time = makeTimeRange(start = 1, end = 2)))
        assertSame(words, resolveDiagnosticPath(words, ""))
        assertSame(words.single(), resolveDiagnosticPath(words, "[0]"))
        assertEquals(1L, resolveDiagnosticPath(words, "[0].time.start"))
        for (path in listOf("[1]", "[-1]", "[0.5]", "[0][0]", "[0].time()", "[0].", ".[0]", "[999999999999999999999]", "[0]\n", "[0].time\n")) {
            assertNull(resolveDiagnosticPath(words, path), path)
        }
        assertNull(resolveDiagnosticPath(mapOf("words" to words), "words.[0]"))
        assertNull(resolveDiagnosticPath(words, "[0].missing"))
    }

    @Test
    fun derivesRomanViewsSeparatelyBySchemeInFirstAppearanceOrder() {
        val first = makeEnrichedWordAnnotation(
            romans = listOf(
                makeEnrichedWordAnnotationRoman(
                    language = "JA-Latn",
                    scheme = "HEPBURN",
                    tokens = listOf(makeTextToken(text = "shi")),
                ),
                makeEnrichedWordAnnotationRoman(
                    language = "ja-latn",
                    scheme = "kunrei",
                    tokens = listOf(makeTextToken(text = "si")),
                ),
                makeEnrichedWordAnnotationRoman(language = "ja-latn", tokens = listOf(makeTextToken(text = "default"))),
            ),
        )
        val last = makeEnrichedWordAnnotation(
            romans = listOf(
                makeEnrichedWordAnnotationRoman(
                    language = "ja-latn",
                    scheme = "KUNREI",
                    tokens = listOf(makeTextToken(text = "ti")),
                ),
                makeEnrichedWordAnnotationRoman(
                    language = "JA-LATN",
                    scheme = "hepburn",
                    tokens = listOf(makeTextToken(text = "chi")),
                ),
                makeEnrichedWordAnnotationRoman(language = "ja-latn", scheme = "", tokens = listOf(makeTextToken(text = "text"))),
            ),
        )
        val words = listOf(
            makeEnrichedWordSpace(text = " "),
            makeEnrichedWordNormal(text = "x", annotation = first),
            makeEnrichedWordSpace(text = "  "),
            makeEnrichedWordNormal(text = "omitted"),
            makeEnrichedWordNormal(text = "y", annotation = last),
            makeEnrichedWordSpace(text = " "),
        )
        val expected = listOf(
            LineRomanView(
                language = "ja-latn",
                scheme = "hepburn",
                text = "shi chi",
            ),
            LineRomanView(language = "ja-latn", scheme = "kunrei", text = "si ti"),
            LineRomanView(language = "ja-latn", text = "default text"),
        )
        assertEquals(expected, deriveEnrichedLineRomanViews(makeEnrichedLineContentWords(words)))
        val stored = gondola.lyrics.model.document.makeDocumentLineContentWords(
            words.map { word ->
                val annotation = word.annotation?.let { source ->
                    gondola.lyrics.model.document.makeDocumentWordAnnotation(
                        romans = source.romans.map { roman ->
                            gondola.lyrics.model.document.makeDocumentWordAnnotationRoman(
                                language = roman.language,
                                scheme = roman.scheme,
                                tokens = roman.tokens,
                            )
                        },
                    )
                }
                if (word.type == WordType.WORD_TYPE_SPACE) {
                    gondola.lyrics.model.document.makeDocumentWordSpace(text = word.text)
                } else {
                    gondola.lyrics.model.document.makeDocumentWordNormal(text = word.text, annotation = annotation)
                }
            },
        )
        assertEquals(
            expected,
            gondola.lyrics.model.document.deriveDocumentLineRomanViews(stored),
        )
        assertEquals("HEPBURN", first.romans[0].scheme)
    }

    @Test
    fun derivesLowercasedLineLanguagesWithoutRepeats() {
        val line = makeEnrichedLineNormal(languages = listOf("JA-JP", "ja-jp", "EN"))
        val languages = resolveEnrichedLineLanguages(line)

        assertEquals(listOf("ja-jp", "en"), languages)
        assertEquals(listOf("JA-JP", "ja-jp", "EN"), line.languages)
    }

    @Test
    fun fallsBackToWordLanguages() {
        val line = makeEnrichedLineNormal(
            content = makeEnrichedLineContentWords(
                listOf(
                    makeEnrichedWordNormal(text = "hi", language = "EN"),
                    makeEnrichedWordSpace(text = " "),
                    makeEnrichedWordNormal(text = "there", language = "en"),
                ),
            ),
        )
        assertEquals(listOf("en"), resolveEnrichedLineLanguages(line))
    }

    // Resolving has to agree with what validate reports about a duplicate and an empty id, or the two tell different stories.
    @Test
    fun keepsFirstAgentClaimingId() {
        val agents = listOf(
            makeAgent(id = "a", type = AgentType.AGENT_TYPE_PERSON, names = listOf(makeText(text = "first"))),
            makeAgent(id = "a", type = AgentType.AGENT_TYPE_PERSON, names = listOf(makeText(text = "second"))),
        )
        val resolved = resolveEnrichedLineAgents(makeEnrichedLineNormal(agentIds = listOf("a")), agents)
        assertEquals(listOf("first"), resolved.map { it.names[0].text })
    }

    @Test
    fun resolvesNeitherEmptyNorUnknownAgentId() {
        val agents = listOf(makeAgent(id = "", type = AgentType.AGENT_TYPE_PERSON), makeAgent(id = "a", type = AgentType.AGENT_TYPE_PERSON))
        assertEquals(emptyList(), resolveEnrichedLineAgents(makeEnrichedLineNormal(agentIds = listOf("", "ghost")), agents))
    }

    // The wire range is wider than the schema's time range, so construction and validation enforce different bounds.
    @Test
    fun preservesUnsignedBoundsWithoutTruncation() {
        val overflow = makeTimeRange(start = 4294967295L, end = 0)
        assertEquals(listOf(Diagnostic("time", DiagnosticCode.TimeRangeStartOverflow)), validateTimeRange(overflow, "time"))
        assertEquals(-4294967295L, getTimeRangeDuration(overflow))
        assertFailsWith<IllegalArgumentException> { makeTimeRange(start = -1) }
        assertFailsWith<IllegalArgumentException> { makeTimeRange(end = 4294967296L) }
    }

    @Test
    fun resolvesNativeDiagnosticPathsWithPresenceAndNumericValues() {
        val lyric = Lyric(
            timing = TimingLevel(99),
            meta = Meta(duration = 4294967295L),
            extra = mapOf("\$private" to "kept"),
            lines = listOf(
                Line(time = TimeRange(end = 0), content = LineContent(words = listOf(Word(type = WordType(-1), language = "")))),
            ),
        )

        assertEquals(99, resolveDiagnosticPath(lyric, "timing"))
        assertEquals(4294967295L, resolveDiagnosticPath(lyric, "meta.duration"))
        assertEquals(0L, resolveDiagnosticPath(lyric, "lines[0].time.end"))
        assertEquals(-1, resolveDiagnosticPath(lyric, "lines[0].content.words[0].type"))
        assertEquals("", resolveDiagnosticPath(lyric, "lines[0].content.words[0].language"))
        assertEquals("kept", resolveDiagnosticPath(lyric, "extra.\$private"))
        assertNull(resolveDiagnosticPath(lyric, "lines[0].content.words[0].time"))
        assertNull(resolveDiagnosticPath(lyric, "lines[1].time"))
        assertNull(resolveDiagnosticPath(lyric, "lines[0].missing"))
    }

    // Java whitespace classes differ from Unicode White_Space, so the explicit JVM character set needs its own regression check.
    @Test
    fun wordSeparatorsUseUnicodeWhiteSpace() {
        for (separator in listOf("\u0085", "\u00a0", "\u2007", "\u202f")) {
            assertEquals(emptyList(), validateEnrichedWord(makeEnrichedWordSpace(text = separator)))
            assertEquals(
                listOf(Diagnostic("text", DiagnosticCode.WordTextSeparator)),
                validateEnrichedWord(makeEnrichedWordNormal(text = "a${separator}b"), timing = TimingLevel.TIMING_LEVEL_LINE),
            )
        }
        assertEquals(emptyList(), validateEnrichedWord(makeEnrichedWordNormal(text = "a\u200bb"), timing = TimingLevel.TIMING_LEVEL_LINE))
        assertEquals(listOf(Diagnostic("text", DiagnosticCode.WordTextNotSeparator)), validateEnrichedWord(makeEnrichedWordSpace(text = "\u200b")))
    }
}
