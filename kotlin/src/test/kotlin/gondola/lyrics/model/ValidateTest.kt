package gondola.lyrics.model

import gondola.lyrics.model.common.AgentType
import gondola.lyrics.model.common.CreditRole
import gondola.lyrics.model.common.Diagnostic
import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.Part
import gondola.lyrics.model.common.PartType
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.common.canonicalizeMetaCredit
import gondola.lyrics.model.common.makeAgent
import gondola.lyrics.model.common.makeMetaCredit
import gondola.lyrics.model.common.makePart
import gondola.lyrics.model.common.makeText
import gondola.lyrics.model.common.makeTextToken
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.resolveDiagnosticPath
import gondola.lyrics.model.common.validateMeta
import gondola.lyrics.model.common.validateMetaCredit
import gondola.lyrics.model.common.validateTimeRange
import gondola.lyrics.model.document.makeDocumentLineBackground
import gondola.lyrics.model.document.makeDocumentLineContentText
import gondola.lyrics.model.document.makeDocumentLineInstrumental
import gondola.lyrics.model.document.makeDocumentLineNormal
import gondola.lyrics.model.document.makeDocumentLyric
import gondola.lyrics.model.document.validateDocumentLine
import gondola.lyrics.model.document.validateDocumentLyric
import gondola.lyrics.model.enriched.LanguageUsage
import gondola.lyrics.model.enriched.Line
import gondola.lyrics.model.enriched.Lyric
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.canonicalizeEnrichedLyric
import gondola.lyrics.model.enriched.deriveEnrichedLanguageUsages
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotation
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRoman
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationRomanContentText
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationTranslation
import gondola.lyrics.model.enriched.makeEnrichedLineBackground
import gondola.lyrics.model.enriched.makeEnrichedLineContentText
import gondola.lyrics.model.enriched.makeEnrichedLineContentWords
import gondola.lyrics.model.enriched.makeEnrichedLineInstrumental
import gondola.lyrics.model.enriched.makeEnrichedLineNormal
import gondola.lyrics.model.enriched.makeEnrichedLyric
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotation
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotationRoman
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotationRuby
import gondola.lyrics.model.enriched.makeEnrichedWordAnnotationTranslation
import gondola.lyrics.model.enriched.makeEnrichedWordEmphasis
import gondola.lyrics.model.enriched.makeEnrichedWordNormal
import gondola.lyrics.model.enriched.makeEnrichedWordSpace
import gondola.lyrics.model.enriched.validateEnrichedLanguageUsage
import gondola.lyrics.model.enriched.validateEnrichedLine
import gondola.lyrics.model.enriched.validateEnrichedLineAnnotation
import gondola.lyrics.model.enriched.validateEnrichedLyric
import gondola.lyrics.model.enriched.validateEnrichedWord
import gondola.lyrics.model.enriched.validateEnrichedWordAnnotation
import kotlin.test.Test
import kotlin.test.assertEquals

private fun textLine(start: Long, end: Long? = null): Line {
    return makeEnrichedLineNormal(time = makeTimeRange(start = start, end = end), content = makeEnrichedLineContentText("x"))
}

private fun lineTimed(vararg lines: Line): Lyric {
    return makeEnrichedLyric(format = "lrc", timing = TimingLevel.TIMING_LEVEL_LINE, status = LyricStatus.LYRIC_STATUS_VALID, lines = lines.toList())
}

private fun List<Diagnostic>.asPairs(): List<Pair<String, String>> {
    return map { it.path to it.code.value }
}

private fun validatePartsInBothLayers(parts: List<Part?>): List<List<Diagnostic>> {
    val played = makeEnrichedLyric(
        timing = TimingLevel.TIMING_LEVEL_NONE,
        status = LyricStatus.LYRIC_STATUS_VALID,
        lines = parts.map { makeEnrichedLineNormal(part = it, content = makeEnrichedLineContentText("line")) },
    )
    val stored = makeDocumentLyric(
        timing = TimingLevel.TIMING_LEVEL_NONE,
        lines = parts.map { makeDocumentLineNormal(part = it, content = makeDocumentLineContentText("line")) },
    )
    return listOf(validateEnrichedLyric(played), validateDocumentLyric(stored))
}

private fun validateTimedPartsInBothLayers(parts: List<Part?>, sungLineIndices: Set<Int>): List<List<Diagnostic>> {
    val documentLines = parts.mapIndexed { index, part ->
        val time = makeTimeRange(start = index * 1000L, end = (index + 1) * 1000L)
        if (index in sungLineIndices) {
            makeDocumentLineNormal(part = part, time = time, content = makeDocumentLineContentText("line"))
        } else {
            makeDocumentLineInstrumental(part = part, time = time)
        }
    }
    val enrichedLines = parts.mapIndexed { index, part ->
        val time = makeTimeRange(start = index * 1000L, end = (index + 1) * 1000L)
        if (index in sungLineIndices) {
            makeEnrichedLineNormal(part = part, time = time, content = makeEnrichedLineContentText("line"))
        } else {
            makeEnrichedLineInstrumental(part = part, time = time)
        }
    }
    val document = makeDocumentLyric(timing = TimingLevel.TIMING_LEVEL_LINE, lines = documentLines)
    val enriched = makeEnrichedLyric(status = LyricStatus.LYRIC_STATUS_VALID, timing = TimingLevel.TIMING_LEVEL_LINE, lines = enrichedLines)
    return listOf(validateDocumentLyric(document), validateEnrichedLyric(enriched))
}

class ValidateTest {
    @Test
    fun acceptsNewCreditRolesWithOptionalSourceLabelsAndPreservesTheirMeaning() {
        for (role in listOf(CreditRole.CREDIT_ROLE_SONGWRITER, CreditRole.CREDIT_ROLE_RECORDING_ENGINEER)) {
            for (raw in listOf(null, "Source Role")) {
                val credit = makeMetaCredit(role = role, raw = raw, names = listOf(makeText(text = "Contributor")))
                assertEquals(emptyList(), validateMetaCredit(credit))
                assertEquals(credit, canonicalizeMetaCredit(credit))
            }
        }
    }

    @Test
    fun locatesAgentReferenceDiagnosticsThroughRenamedFieldsInBothLayers() {
        val time = makeTimeRange(start = 1000, end = 2000)
        val agents = listOf(makeAgent(id = "known", type = AgentType.AGENT_TYPE_PERSON))
        val agentIds = listOf("known", "missing")
        val document = makeDocumentLyric(
            timing = TimingLevel.TIMING_LEVEL_LINE,
            agents = agents,
            lines = listOf(
                makeDocumentLineNormal(
                    time = time,
                    agentIds = agentIds,
                    content = makeDocumentLineContentText("line"),
                    backgrounds = listOf(
                        makeDocumentLineBackground(
                            time = time,
                            agentIds = listOf("background-missing"),
                            content = makeDocumentLineContentText("background"),
                        ),
                    ),
                ),
            ),
        )
        val enriched = makeEnrichedLyric(
            status = LyricStatus.LYRIC_STATUS_VALID,
            timing = TimingLevel.TIMING_LEVEL_LINE,
            agents = agents,
            lines = listOf(
                makeEnrichedLineNormal(
                    time = time,
                    agentIds = agentIds,
                    content = makeEnrichedLineContentText("line"),
                    backgrounds = listOf(
                        makeEnrichedLineBackground(
                            time = time,
                            agentIds = listOf("background-missing"),
                            content = makeEnrichedLineContentText("background"),
                        ),
                    ),
                ),
            ),
        )
        for ((lyric, diagnostics) in listOf(document to validateDocumentLyric(document), enriched to validateEnrichedLyric(enriched))) {
            assertEquals(
                listOf(
                    "lines[0].agentIds[1]" to "lyric.line.agent.dangling",
                    "lines[0].backgrounds[0].agentIds[0]" to "lyric.line.agent.dangling",
                ),
                diagnostics.asPairs(),
            )
            assertEquals(listOf("missing", "background-missing"), diagnostics.map { resolveDiagnosticPath(lyric, it.path) })
        }
        val documentInstrumental = makeDocumentLineInstrumental(time = time).copy(agentIds = listOf("missing"))
        val enrichedInstrumental = makeEnrichedLineInstrumental(time = time).copy(agentIds = listOf("missing"))
        for ((line, diagnostics) in listOf(
            documentInstrumental to validateDocumentLine(documentInstrumental, "", TimingLevel.TIMING_LEVEL_LINE),
            enrichedInstrumental to validateEnrichedLine(enrichedInstrumental, "", TimingLevel.TIMING_LEVEL_LINE),
        )) {
            assertEquals(listOf("agentIds" to "line.agent_ids.unexpected"), diagnostics.asPairs())
            assertEquals(listOf("missing"), resolveDiagnosticPath(line, diagnostics.single().path))
        }
    }

    @Test
    fun requiresEmphasisDecisionWhenOriginIsSet() {
        for (derived in listOf(false, true)) {
            val line = makeEnrichedLineNormal(
                time = makeTimeRange(start = 1000, end = 5000),
                content = makeEnrichedLineContentWords(
                    listOf(
                        makeEnrichedWordNormal(
                            text = "ah",
                            time = makeTimeRange(start = 1000, end = 5000),
                            emphasis = makeEnrichedWordEmphasis(derived = derived),
                        ),
                    ),
                ),
            )
            val lyric = canonicalizeEnrichedLyric(
                makeEnrichedLyric(timing = TimingLevel.TIMING_LEVEL_WORD, status = LyricStatus.LYRIC_STATUS_VALID, lines = listOf(line)),
            )
            assertEquals(
                listOf("lines[0].content.words[0].emphasis.value" to "line.word.emphasis.value.missing"),
                validateEnrichedLyric(lyric).asPairs(),
            )
            for (value in listOf(false, true)) {
                assertEquals(
                    emptyList(),
                    validateEnrichedWord(makeEnrichedWordNormal(text = "ah", emphasis = makeEnrichedWordEmphasis(value = value, derived = derived))),
                )
            }
        }
        assertEquals(emptyList(), validateEnrichedWord(makeEnrichedWordNormal(text = "ah", emphasis = makeEnrichedWordEmphasis())))
        assertEquals(emptyList(), validateEnrichedWord(makeEnrichedWordNormal(text = "ah", emphasis = makeEnrichedWordEmphasis(value = false))))
    }

    @Test
    fun allowsConsistentPartIdsAcrossAdjacentLinesWithExactComparison() {
        val part = makePart(type = PartType.PART_TYPE_CHORUS, id = "Chorus", raw = "chorus")
        val parts = listOf(
            part,
            part.copy(),
            part.copy(id = "chorus"),
            part.copy(id = null),
            part.copy(id = ""),
            null,
            makePart(type = PartType.PART_TYPE_VERSE, raw = "Verse 1"),
            makePart(type = PartType.PART_TYPE_VERSE, raw = "Verse 2"),
        )
        for (diagnostics in validatePartsInBothLayers(parts)) {
            assertEquals(emptyList(), diagnostics)
        }
    }

    @Test
    fun reportsInconsistentTypeOrRawForSamePartId() {
        val part = makePart(type = PartType.PART_TYPE_CHORUS, id = "Chorus", raw = "chorus")
        val parts = listOf(
            part,
            part.copy(type = PartType.PART_TYPE_VERSE),
            part.copy(raw = "Chorus"),
            makePart(type = PartType.PART_TYPE_CHORUS, id = "Other"),
            makePart(type = PartType.PART_TYPE_CHORUS, id = "Other", raw = ""),
        )
        for (diagnostics in validatePartsInBothLayers(parts)) {
            assertEquals(
                listOf(
                    "lines[1].part" to "lyric.part.mismatch",
                    "lines[2].part" to "lyric.part.mismatch",
                    "lines[4].part" to "lyric.part.mismatch",
                ),
                diagnostics.asPairs(),
            )
        }
    }

    @Test
    fun reportsReusedPartIdOnlyAtStartOfNewRun() {
        val part = makePart(type = PartType.PART_TYPE_CHORUS, id = "Chorus", raw = "chorus")
        val separators = listOf(part.copy(id = "Other"), null, part.copy(id = ""), part.copy(id = null))
        for (separator in separators) {
            for (diagnostics in validatePartsInBothLayers(listOf(part, separator, part, part))) {
                assertEquals(listOf("lines[2].part.id" to "lyric.part.id.reused"), diagnostics.asPairs())
            }
        }
    }

    @Test
    fun allowsInterludesBeforeAndBetweenSungSectionsWhilePreservingInstrumentalEndings() {
        val interlude = makePart(type = PartType.PART_TYPE_INTERLUDE, id = "opening", raw = "interlude")
        val parts = listOf(
            interlude,
            interlude.copy(),
            makePart(type = PartType.PART_TYPE_VERSE),
            interlude.copy(id = "middle"),
            makePart(type = PartType.PART_TYPE_CHORUS),
            makePart(type = PartType.PART_TYPE_OUTRO),
            makePart(type = PartType.PART_TYPE_INSTRUMENTAL),
        )
        for (diagnostics in validateTimedPartsInBothLayers(parts, setOf(2, 4))) {
            assertEquals(emptyList(), diagnostics)
        }
    }

    @Test
    fun rejectsEveryTrailingInterludeEvenWhenLaterUnsungSectionsRemain() {
        val interlude = makePart(type = PartType.PART_TYPE_INTERLUDE, raw = "interlude")
        val verse = makePart(type = PartType.PART_TYPE_VERSE)
        val cases = listOf(
            Triple(listOf(verse, interlude), setOf(0), listOf(1)),
            Triple(listOf(verse, interlude, interlude.copy()), setOf(0), listOf(1, 2)),
            Triple(listOf(verse, interlude.copy(id = "tail"), interlude.copy(id = "tail")), setOf(0), listOf(1, 2)),
            Triple(listOf(verse, interlude, makePart(type = PartType.PART_TYPE_OUTRO)), setOf(0), listOf(1)),
            Triple(listOf(verse, interlude, makePart(type = PartType.PART_TYPE_INSTRUMENTAL)), setOf(0), listOf(1)),
            Triple(listOf(interlude), emptySet(), listOf(0)),
        )
        for ((parts, sung, trailing) in cases) {
            val expected = trailing.map { "lines[$it].part.type" to "lyric.part.interlude.trailing" }
            for (diagnostics in validateTimedPartsInBothLayers(parts, sung)) {
                assertEquals(expected, diagnostics.asPairs())
            }
        }
    }

    @Test
    fun requiresInterludeSectionsToBeCarriedByInstrumentalLines() {
        val part = makePart(type = PartType.PART_TYPE_INTERLUDE)
        val time = makeTimeRange(start = 0, end = 1000)
        val documentLine = makeDocumentLineNormal(part = part, time = time, content = makeDocumentLineContentText("line"))
        val enrichedLine = makeEnrichedLineNormal(part = part, time = time, content = makeEnrichedLineContentText("line"))
        val expected = listOf("line.part.type" to "line.part.interlude.not_instrumental")
        assertEquals(expected, validateDocumentLine(documentLine, "line", TimingLevel.TIMING_LEVEL_LINE).asPairs())
        assertEquals(expected, validateEnrichedLine(enrichedLine, "line", TimingLevel.TIMING_LEVEL_LINE).asPairs())
        assertEquals(emptyList(), validateDocumentLine(makeDocumentLineInstrumental(part = part, time = time), "line", TimingLevel.TIMING_LEVEL_LINE))
        assertEquals(emptyList(), validateEnrichedLine(makeEnrichedLineInstrumental(part = part, time = time), "line", TimingLevel.TIMING_LEVEL_LINE))
    }

    @Test
    fun keysRomanAndRubyAnnotationsByLanguageAndScheme() {
        val identities = listOf(
            "JA-Latn" to "HEPBURN",
            "ja-latn" to "kunrei",
            "ja" to "hepburn",
            "ja-latn" to "hepburn",
            "ja-latn" to null,
            "JA-LATN" to "",
        )
        val word = makeEnrichedWordAnnotation(
            rubies = identities.map { (language, scheme) -> makeEnrichedWordAnnotationRuby(language = language, scheme = scheme) },
            romans = identities.map { (language, scheme) -> makeEnrichedWordAnnotationRoman(language = language, scheme = scheme) },
            translations = listOf("zh-Hans", "ZH-HANS").map { makeEnrichedWordAnnotationTranslation(language = it, text = "translation") },
        )
        val line = makeEnrichedLineAnnotation(
            romans = identities.map { (language, scheme) ->
                makeEnrichedLineAnnotationRoman(language = language, scheme = scheme, content = makeEnrichedLineAnnotationRomanContentText("roman"))
            },
            translations = listOf("zh-Hans", "ZH-HANS").map { makeEnrichedLineAnnotationTranslation(language = it, text = "translation") },
        )
        val expectedWord = listOf(
            "rubies[3]" to "line.word.annotation.rubies.duplicate",
            "rubies[5]" to "line.word.annotation.rubies.duplicate",
            "romans[3]" to "line.word.annotation.romans.duplicate",
            "romans[5]" to "line.word.annotation.romans.duplicate",
            "translations[1]" to "line.word.annotation.translations.language.duplicate",
        )
        val expectedLine = listOf(
            "romans[3]" to "line.annotation.romans.duplicate",
            "romans[5]" to "line.annotation.romans.duplicate",
            "translations[1]" to "line.annotation.translations.language.duplicate",
        )
        assertEquals(expectedWord, validateEnrichedWordAnnotation(word).asPairs())
        assertEquals(expectedLine, validateEnrichedLineAnnotation(line).asPairs())

        val documentWord = gondola.lyrics.model.document.makeDocumentWordAnnotation(
            rubies = identities.map { (language, scheme) ->
                gondola.lyrics.model.document.makeDocumentWordAnnotationRuby(language = language, scheme = scheme)
            },
            romans = identities.map { (language, scheme) ->
                gondola.lyrics.model.document.makeDocumentWordAnnotationRoman(language = language, scheme = scheme)
            },
            translations = listOf("zh-Hans", "ZH-HANS").map {
                gondola.lyrics.model.document.makeDocumentWordAnnotationTranslation(language = it, text = "translation")
            },
        )
        val documentLine = gondola.lyrics.model.document.makeDocumentLineAnnotation(
            romans = identities.map { (language, scheme) ->
                gondola.lyrics.model.document.makeDocumentLineAnnotationRoman(
                    language = language,
                    scheme = scheme,
                    content = gondola.lyrics.model.document.makeDocumentLineAnnotationRomanContentText("roman"),
                )
            },
            translations = listOf("zh-Hans", "ZH-HANS").map {
                gondola.lyrics.model.document.makeDocumentLineAnnotationTranslation(language = it, text = "translation")
            },
        )
        assertEquals(expectedWord, gondola.lyrics.model.document.validateDocumentWordAnnotation(documentWord).asPairs())
        assertEquals(expectedLine, gondola.lyrics.model.document.validateDocumentLineAnnotation(documentLine).asPairs())
    }

    @Test
    fun validatesAnnotationLanguagesIndependentlyOfSchemes() {
        for (language in listOf("ja-latn", "ja_Latn")) {
            val scheme = "custom_romanization"
            val line = makeEnrichedLineNormal(
                time = makeTimeRange(start = 0, end = 1000),
                content = makeEnrichedLineContentWords(
                    listOf(
                        makeEnrichedWordNormal(
                            text = "x",
                            time = makeTimeRange(start = 0, end = 1000),
                            annotation = makeEnrichedWordAnnotation(
                                rubies = listOf(
                                    makeEnrichedWordAnnotationRuby(
                                        language = language,
                                        scheme = scheme,
                                        tokens = listOf(makeTextToken(text = "shi")),
                                    ),
                                ),
                                romans = listOf(
                                    makeEnrichedWordAnnotationRoman(
                                        language = language,
                                        scheme = scheme,
                                        tokens = listOf(makeTextToken(text = "shi")),
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
                annotation = makeEnrichedLineAnnotation(
                    romans = listOf(
                        makeEnrichedLineAnnotationRoman(
                            language = language,
                            scheme = "independent_romanization",
                            content = makeEnrichedLineAnnotationRomanContentText("shi"),
                        ),
                    ),
                ),
            )
            val expected = if (language == "ja-latn") {
                emptyList()
            } else {
                listOf(
                    "annotation.romans[0].language" to "language.tag.malformed",
                    "content.words[0].annotation.romans[0].language" to "language.tag.malformed",
                    "content.words[0].annotation.rubies[0].language" to "language.tag.malformed",
                )
            }
            assertEquals(expected, validateEnrichedLine(line, timing = TimingLevel.TIMING_LEVEL_WORD).asPairs().sortedBy { it.first })
        }
    }

    @Test
    fun reportsNativeTimeBoundsOutsideSchemaDomain() {
        assertEquals(
            listOf("time" to "time.range.start.invalid", "time" to "time.range.end.invalid"),
            validateTimeRange(TimeRange(start = -1, end = -2), "time").asPairs(),
        )
        assertEquals(
            listOf("time" to "time.range.start.overflow", "time" to "time.range.end.overflow"),
            validateTimeRange(TimeRange(start = 2147483648L, end = Long.MAX_VALUE), "time").asPairs(),
        )
    }

    @Test
    fun reportsNativeLineCountsAlongsideTagErrors() {
        val usage = LanguageUsage(lineCount = -1)
        val diagnostics = validateEnrichedLanguageUsage(usage, "languageUsages[0]")
        assertEquals(
            listOf("languageUsages[0].tag" to "language.usage.tag.empty", "languageUsages[0].lineCount" to "language.usage.line_count.invalid"),
            diagnostics.asPairs(),
        )
        assertEquals(-1L, resolveDiagnosticPath(mapOf("languageUsages" to listOf(usage)), diagnostics.last().path))
        assertEquals(
            listOf("lineCount" to "language.usage.line_count.overflow"),
            validateEnrichedLanguageUsage(LanguageUsage(tag = "en", lineCount = 4294967296L)).asPairs(),
        )
    }

    @Test
    fun reportsNativeDurationBoundsOutsideSchemaDomain() {
        assertEquals(listOf("duration" to "meta.duration.invalid"), validateMeta(Meta(duration = -1)).asPairs())
        assertEquals(listOf("duration" to "meta.duration.overflow"), validateMeta(Meta(duration = Long.MAX_VALUE)).asPairs())
    }

    @Test
    fun acceptsWordLevelLyric() {
        val lines = listOf(
            makeEnrichedLineNormal(
                time = makeTimeRange(start = 1000, end = 2000),
                languages = listOf("en"),
                content = makeEnrichedLineContentWords(
                    listOf(
                        makeEnrichedWordNormal(text = "hi", language = "en", time = makeTimeRange(start = 1000, end = 1500)),
                        makeEnrichedWordSpace(text = " "),
                        makeEnrichedWordNormal(text = "there", language = "en", time = makeTimeRange(start = 1500, end = 2000)),
                    ),
                ),
            ),
        )
        val lyric = makeEnrichedLyric(
            format = "lrc",
            timing = TimingLevel.TIMING_LEVEL_WORD,
            status = LyricStatus.LYRIC_STATUS_VALID,
            languageUsages = deriveEnrichedLanguageUsages(lines),
            lines = lines,
        )
        assertEquals(emptyList(), validateEnrichedLyric(lyric))
    }

    // The codes are a contract the other bindings copy verbatim, so they are asserted as the strings they are.
    @Test
    fun reportsUndeclaredTiming() {
        val lyric = makeDocumentLyric(
            format = "lrc",
            lines = listOf(
                makeDocumentLineNormal(
                    time = makeTimeRange(start = 1000),
                    languages = listOf("en"),
                    content = makeDocumentLineContentText("hi there"),
                ),
            ),
        )
        assertEquals(listOf("timing" to "lyric.timing.unspecified"), validateDocumentLyric(lyric).asPairs())
    }

    @Test
    fun reportsMissingLanguageUsagesAndUnsplitWord() {
        val lyric = makeEnrichedLyric(
            format = "lrc",
            timing = TimingLevel.TIMING_LEVEL_WORD,
            status = LyricStatus.LYRIC_STATUS_VALID,
            lines = listOf(
                makeEnrichedLineNormal(
                    time = makeTimeRange(start = 1000, end = 2000),
                    languages = listOf("en"),
                    content = makeEnrichedLineContentWords(
                        listOf(makeEnrichedWordNormal(text = "hi there", language = "en", time = makeTimeRange(start = 1000, end = 2000))),
                    ),
                ),
            ),
        )
        assertEquals(
            listOf(
                "languageUsages" to "lyric.language_usages.mismatch",
                "lines[0].content.words[0].text" to "word.text.separator",
            ),
            validateEnrichedLyric(lyric).asPairs(),
        )
    }

    // An untimed lyric marks out no stretches, so it reports the line itself instead of asking it for a range it may not have.
    @Test
    fun reportsInstrumentalLineInUntimedLyric() {
        val lyric = makeEnrichedLyric(
            format = "lrc",
            timing = TimingLevel.TIMING_LEVEL_NONE,
            status = LyricStatus.LYRIC_STATUS_VALID,
            lines = listOf(makeEnrichedLineInstrumental()),
        )
        assertEquals(listOf("lines[0].type" to "lyric.timing.none.instrumental"), validateEnrichedLyric(lyric).asPairs())
    }

    // A line other than the last ends where the timeline moves on, so one left open would be shown for the rest of the song.
    @Test
    fun reportsLineLeftOpenAbove() {
        val lyric = lineTimed(textLine(0, 1000), textLine(1000), textLine(2000, 3000))
        assertEquals(listOf("lines[1].time.end" to "lyric.line.time.end.missing"), validateEnrichedLyric(lyric).asPairs())
    }

    // Nothing in a lyric states where it stops, so the last line is the one line whose end the data cannot carry.
    @Test
    fun acceptsLastLineLeftOpenAbove() {
        val lyric = lineTimed(textLine(0, 1000), textLine(1000, 2000), textLine(2000))
        assertEquals(emptyList(), validateEnrichedLyric(lyric))
    }

    // A line carrying no range at all is already reported for that, so it is not asked for an end on top.
    @Test
    fun reportsLineWithNoRangeOnce() {
        val lyric = lineTimed(makeEnrichedLineNormal(content = makeEnrichedLineContentText("x")), textLine(1000, 2000))
        assertEquals(listOf("lines[0].time" to "lyric.timing.line.time_missing"), validateEnrichedLyric(lyric).asPairs())
    }

    @Test
    fun reportsLineLeftOpenAboveInDocumentLayer() {
        val lyric = makeDocumentLyric(
            format = "lrc",
            timing = TimingLevel.TIMING_LEVEL_LINE,
            lines = listOf(
                makeDocumentLineNormal(time = makeTimeRange(start = 0), content = makeDocumentLineContentText("x")),
                makeDocumentLineNormal(time = makeTimeRange(start = 1000, end = 2000), content = makeDocumentLineContentText("y")),
            ),
        )
        assertEquals(listOf("lines[0].time.end" to "lyric.line.time.end.missing"), validateDocumentLyric(lyric).asPairs())
    }

    // Word-level timing still marks out each line, and a line carrying no range leaves its words with nothing to fall inside.
    @Test
    fun reportsWordLevelLineWithNoRange() {
        val lines = listOf(
            makeEnrichedLineNormal(
                content = makeEnrichedLineContentWords(listOf(makeEnrichedWordNormal(text = "x", time = makeTimeRange(start = 1000, end = 2000)))),
            ),
        )
        val lyric = makeEnrichedLyric(format = "lrc", timing = TimingLevel.TIMING_LEVEL_WORD, status = LyricStatus.LYRIC_STATUS_VALID, lines = lines)
        assertEquals(listOf("lines[0].time" to "lyric.timing.line.time_missing"), validateEnrichedLyric(lyric).asPairs())
    }
}
