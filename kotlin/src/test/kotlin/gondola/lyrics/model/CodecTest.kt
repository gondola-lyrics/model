package gondola.lyrics.model

import com.google.protobuf.DescriptorProtos.FileDescriptorSet
import com.google.protobuf.Descriptors
import com.google.protobuf.DynamicMessage
import gondola.lyrics.model.common.Meta
import gondola.lyrics.model.common.Part
import gondola.lyrics.model.common.PartType
import gondola.lyrics.model.common.Text
import gondola.lyrics.model.common.TimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.common.UnknownEntry
import gondola.lyrics.model.common.makeMeta
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.document.decodeDocumentLyric
import gondola.lyrics.model.document.encodeDocumentLyric
import gondola.lyrics.model.document.makeDocumentLineContentText
import gondola.lyrics.model.document.makeDocumentLineNormal
import gondola.lyrics.model.document.makeDocumentLyric
import gondola.lyrics.model.enriched.Line
import gondola.lyrics.model.enriched.LineAnnotation
import gondola.lyrics.model.enriched.LineAnnotationRoman
import gondola.lyrics.model.enriched.LineContent
import gondola.lyrics.model.enriched.Lyric
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.Word
import gondola.lyrics.model.enriched.WordAnnotation
import gondola.lyrics.model.enriched.WordAnnotationRoman
import gondola.lyrics.model.enriched.WordAnnotationRuby
import gondola.lyrics.model.enriched.WordAnnotationToken
import gondola.lyrics.model.enriched.WordEmphasis
import gondola.lyrics.model.enriched.WordType
import gondola.lyrics.model.enriched.canonicalizeEnrichedLyric
import gondola.lyrics.model.enriched.decodeEnrichedLyric
import gondola.lyrics.model.enriched.deriveEnrichedLanguageUsages
import gondola.lyrics.model.enriched.encodeEnrichedLyric
import gondola.lyrics.model.enriched.makeEnrichedLineContentWords
import gondola.lyrics.model.enriched.makeEnrichedLineInstrumental
import gondola.lyrics.model.enriched.makeEnrichedLineNormal
import gondola.lyrics.model.enriched.makeEnrichedLyric
import gondola.lyrics.model.enriched.makeEnrichedWordEmphasis
import gondola.lyrics.model.enriched.makeEnrichedWordNormal
import gondola.lyrics.model.enriched.makeEnrichedWordSpace
import gondola.lyrics.model.utils.decodeDocumentLineContent
import gondola.lyrics.model.utils.decodeEnrichedWordEmphasis
import gondola.lyrics.model.utils.encodeDocumentLineContent
import gondola.lyrics.model.utils.encodeEnrichedWordEmphasis
import gondola.lyrics.model.utils.read
import gondola.lyrics.model.utils.write
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import gondola.lyrics.model.document.Line as DocumentLine
import gondola.lyrics.model.document.LineContent as DocumentLineContent
import gondola.lyrics.model.document.Lyric as DocumentLyric
import gondola.lyrics.model.document.Word as DocumentWord

class CodecTest {
    private val schemas by lazy {
        val descriptors = requireNotNull(javaClass.getResourceAsStream("/schema.gen.bin")).use { FileDescriptorSet.parseFrom(it) }
        val sources = descriptors.fileList.associateBy { it.name }
        val files = mutableMapOf<String, Descriptors.FileDescriptor>()
        fun build(name: String): Descriptors.FileDescriptor {
            files[name]?.let { return it }
            val source = sources.getValue(name)
            val file = Descriptors.FileDescriptor.buildFrom(source, source.dependencyList.map(::build).toTypedArray())
            files[name] = file
            return file
        }
        val messages = mutableMapOf<String, Descriptors.Descriptor>()
        fun collect(message: Descriptors.Descriptor) {
            messages[message.fullName] = message
            message.nestedTypes.forEach(::collect)
        }
        sources.keys.forEach { build(it).messageTypes.forEach(::collect) }
        messages
    }

    // The official model is populated independently of generated native fields, so a wrong tag or field mapping cannot validate itself.
    private fun official(name: String, vararg values: Pair<String, Any>): DynamicMessage {
        val descriptor = schemas.getValue(name)
        val builder = DynamicMessage.newBuilder(descriptor)
        for ((fieldName, value) in values) {
            val field = requireNotNull(descriptor.findFieldByName(fieldName))
            val entries = if (field.isRepeated) value as List<*> else listOf(value)
            for (entry in entries) {
                val converted = when {
                    field.javaType == Descriptors.FieldDescriptor.JavaType.ENUM -> field.enumType.findValueByNumberCreatingIfUnknown(entry as Int)
                    field.type == Descriptors.FieldDescriptor.Type.UINT32 -> (entry as Long).toInt()
                    else -> requireNotNull(entry)
                }
                if (field.isRepeated) {
                    builder.addRepeatedField(field, converted)
                } else {
                    builder.setField(field, converted)
                }
            }
        }
        return builder.build()
    }

    private fun fromHex(hex: String): ByteArray {
        return ByteArray(hex.length / 2) { index ->
            hex.substring(index * 2, index * 2 + 2).toInt(16).toByte()
        }
    }

    private fun buildLyric(): Lyric {
        val lines = listOf(
            makeEnrichedLineInstrumental(time = makeTimeRange(start = 0, end = 1000)),
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
        return makeEnrichedLyric(
            format = "lrc",
            timing = Timing.TIMING_WORD,
            status = LyricStatus.LYRIC_STATUS_VALID,
            languages = deriveEnrichedLanguageUsages(lines),
            lines = lines,
        )
    }

    private fun buildDocumentLyric(): DocumentLyric {
        return makeDocumentLyric(
            format = "lrc",
            timing = Timing.TIMING_LINE,
            lines = listOf(
                makeDocumentLineNormal(
                    time = makeTimeRange(start = 1000, end = 2000),
                    languages = listOf("en"),
                    content = makeDocumentLineContentText("hi there"),
                ),
            ),
        )
    }

    @Test
    fun roundTripsEnrichedLyric() {
        val lyric = buildLyric()
        assertEquals(lyric, decodeEnrichedLyric(encodeEnrichedLyric(lyric)))
    }

    @Test
    fun preservesOptionalEmphasisFieldsWithOfficialCodec() {
        val values = listOf(null, false, true)
        for (value in values) {
            for (derived in values) {
                val emphasis = makeEnrichedWordEmphasis(value = value, derived = derived)
                val fields = listOfNotNull(value?.let { "value" to it }, derived?.let { "derived" to it })
                val bytes = official("lyric.enriched.WordEmphasis", *fields.toTypedArray()).toByteArray()
                assertContentEquals(bytes, write(::encodeEnrichedWordEmphasis, emphasis))
                assertEquals(emphasis, read(::decodeEnrichedWordEmphasis, bytes))
            }
        }
    }

    @Test
    fun roundTripsDocumentLyric() {
        val lyric = buildDocumentLyric()
        assertEquals(lyric, decodeDocumentLyric(encodeDocumentLyric(lyric)))
    }

    @Test
    fun matchesOfficialCodecForBothLayers() {
        val wordAnnotation = WordAnnotation(
            rubies = listOf(WordAnnotationRuby(language = "zh-latn", scheme = "pinyin", tokens = listOf(WordAnnotationToken(text = "han")))),
            romans = listOf(WordAnnotationRoman(language = "ja-latn", scheme = "hepburn", tokens = listOf(WordAnnotationToken(text = "shi")))),
        )
        val lineAnnotation = LineAnnotation(romans = listOf(LineAnnotationRoman(language = "ja-latn", scheme = "hepburn", text = "shi")))
        val part = Part(type = PartType.PART_TYPE_CHORUS, id = "Chorus-A", raw = "chorus")
        val meta = Meta(
            offset = -1500,
            duration = 4294967295L,
            language = "",
            unknowns = listOf(UnknownEntry(key = "k", value = "v"), UnknownEntry(key = "k")),
            titles = listOf(Text(text = "\uD83D\uDE00")),
        )
        val native = Lyric(
            version = "1.1.0",
            format = "ttml",
            profile = "amll",
            status = LyricStatus.LYRIC_STATUS_VALID,
            timing = Timing(-1),
            meta = meta,
            extra = mapOf("\$private" to "kept"),
            lines = listOf(
                Line(
                    part = part,
                    content = LineContent(
                        words = listOf(Word(type = WordType(99), language = "", text = "x", emphasis = WordEmphasis(), annotation = wordAnnotation)),
                    ),
                    annotation = lineAnnotation,
                ),
            ),
        )
        val documentWordAnnotation = gondola.lyrics.model.document.WordAnnotation(
            rubies = listOf(
                gondola.lyrics.model.document.WordAnnotationRuby(
                    language = "zh-latn",
                    scheme = "pinyin",
                    tokens = listOf(gondola.lyrics.model.document.WordAnnotationToken(text = "han")),
                ),
            ),
            romans = listOf(
                gondola.lyrics.model.document.WordAnnotationRoman(
                    language = "ja-latn",
                    scheme = "hepburn",
                    tokens = listOf(gondola.lyrics.model.document.WordAnnotationToken(text = "shi")),
                ),
            ),
        )
        val documentLineAnnotation = gondola.lyrics.model.document.LineAnnotation(
            romans = listOf(gondola.lyrics.model.document.LineAnnotationRoman(language = "ja-latn", scheme = "hepburn", text = "shi")),
        )
        val stored = DocumentLyric(
            version = "1.1.0",
            format = "ttml",
            profile = "amll",
            timing = Timing(-1),
            meta = meta,
            extra = mapOf("\$private" to "kept"),
            lines = listOf(
                DocumentLine(
                    part = part,
                    content = DocumentLineContent(
                        words = listOf(
                            DocumentWord(
                                type = gondola.lyrics.model.document.WordType(99),
                                language = "",
                                text = "x",
                                emphasis = false,
                                annotation = documentWordAnnotation,
                            ),
                        ),
                    ),
                    annotation = documentLineAnnotation,
                ),
            ),
        )
        val officialMeta = official(
            "lyric.common.Meta",
            "offset" to -1500,
            "duration" to 4294967295L,
            "language" to "",
            "unknowns" to
                listOf(official("lyric.common.UnknownEntry", "key" to "k", "value" to "v"), official("lyric.common.UnknownEntry", "key" to "k")),
            "titles" to listOf(official("lyric.common.Text", "text" to "\uD83D\uDE00")),
        )
        val officialPart = official("lyric.common.Part", "type" to 5, "id" to "Chorus-A", "raw" to "chorus")
        for (layer in listOf("enriched", "document")) {
            val officialWordAnnotation = official(
                "lyric.$layer.WordAnnotation",
                "rubies" to listOf(
                    official(
                        "lyric.$layer.WordAnnotationRuby",
                        "language" to "zh-latn",
                        "scheme" to "pinyin",
                        "tokens" to listOf(official("lyric.$layer.WordAnnotationToken", "text" to "han")),
                    ),
                ),
                "romans" to listOf(
                    official(
                        "lyric.$layer.WordAnnotationRoman",
                        "language" to "ja-latn",
                        "scheme" to "hepburn",
                        "tokens" to listOf(official("lyric.$layer.WordAnnotationToken", "text" to "shi")),
                    ),
                ),
            )
            val officialLineAnnotation = official(
                "lyric.$layer.LineAnnotation",
                "romans" to listOf(official("lyric.$layer.LineAnnotationRoman", "language" to "ja-latn", "scheme" to "hepburn", "text" to "shi")),
            )
            val emphasis = if (layer == "enriched") official("lyric.enriched.WordEmphasis") else false
            val values = listOf(
                "version" to "1.1.0",
                "format" to "ttml",
                "profile" to "amll",
                "timing" to -1,
                "meta" to officialMeta,
                "extra" to listOf(official("lyric.$layer.Lyric.ExtraEntry", "key" to "\$private", "value" to "kept")),
                "lines" to listOf(
                    official(
                        "lyric.$layer.Line",
                        "part" to officialPart,
                        "content" to official(
                            "lyric.$layer.LineContent",
                            "words" to listOf(
                                official(
                                    "lyric.$layer.Word",
                                    "type" to 99,
                                    "language" to "",
                                    "text" to "x",
                                    "emphasis" to emphasis,
                                    "annotation" to officialWordAnnotation,
                                ),
                            ),
                        ),
                        "annotation" to officialLineAnnotation,
                    ),
                ),
            ) + if (layer == "enriched") listOf("status" to 2) else emptyList()
            val bytes = official("lyric.$layer.Lyric", *values.toTypedArray()).toByteArray()
            if (layer == "enriched") {
                assertContentEquals(bytes, encodeEnrichedLyric(native))
                assertEquals(native, decodeEnrichedLyric(bytes))
            } else {
                assertContentEquals(bytes, encodeDocumentLyric(stored))
                assertEquals(stored, decodeDocumentLyric(bytes))
            }
        }
    }

    @Test
    fun preservesPresenceInStandardSample() {
        val bytes = fromHex("0a090801120210002201610a0d0801120208051a0022016130000a07086322016130011200")
        val expected = DocumentLineContent(
            words = listOf(
                DocumentWord(type = gondola.lyrics.model.document.WordType.WORD_TYPE_NORMAL, time = TimeRange(end = 0), text = "a"),
                DocumentWord(
                    type = gondola.lyrics.model.document.WordType.WORD_TYPE_NORMAL,
                    time = TimeRange(start = 5),
                    language = "",
                    text = "a",
                    emphasis = false,
                ),
                DocumentWord(type = gondola.lyrics.model.document.WordType(99), text = "a", emphasis = true),
            ),
            text = "",
        )
        assertEquals(expected, read(::decodeDocumentLineContent, bytes))
        assertContentEquals(bytes, write(::encodeDocumentLineContent, expected))
    }

    @Test
    fun dropsUnknownFieldsWithoutDroppingBusinessMetadata() {
        val lyric = buildLyric().copy(
            meta = Meta(unknowns = listOf(UnknownEntry(key = "k", value = "first"), UnknownEntry(key = "k", value = "second"))),
        )
        val bytes = encodeEnrichedLyric(lyric)
        val decoded = decodeEnrichedLyric(bytes + fromHex("a00601"))
        assertEquals(lyric, decoded)
        assertContentEquals(bytes, encodeEnrichedLyric(decoded))
        val emptyMeta = decodeEnrichedLyric(fromHex("3203a00601"))
        assertEquals(Meta(), emptyMeta.meta)
        assertNull(canonicalizeEnrichedLyric(emptyMeta).meta)
    }

    @Test
    fun dropsSubmessageThatIsEmptyForReal() {
        val canonical = canonicalizeEnrichedLyric(buildLyric().copy(meta = makeMeta()))
        assertNull(canonical.meta)
    }

    // These rejection boundaries follow the Go implementation, including cases the official Java reader accepts.
    @Test
    fun rejectsMalformedWireData() {
        val malformed = mapOf(
            "missing field value" to "0a",
            "length beyond input" to "0a05",
            "length beyond nested range" to "32020a7f",
            "zero field number" to "00",
            "invalid wire type" to "0f",
            "tag beyond 32 bits" to "8880808010",
            "varint beyond 64 bits" to "08ffffffffffffffffff02",
            "unterminated varint" to "08ffffffffffffffffffff",
            "invalid UTF-8" to "0a01ff",
            "overlong UTF-8" to "0a02c080",
            "UTF-8 surrogate" to "0a03eda080",
            "UTF-8 beyond Unicode" to "0a04f4908080",
            "stray end group" to "0c",
            "mismatched end group" to "a306ac06",
            "unterminated group" to "a306",
            "excessive group depth" to "a306".repeat(10002) + "a406".repeat(10002),
        )
        for ((reason, hex) in malformed) {
            assertFailsWith<IllegalArgumentException>(reason) { decodeEnrichedLyric(fromHex(hex)) }
        }
    }

    @Test
    fun followsWireMergeAndSkippingRules() {
        val accepted = mapOf(
            "known field with wrong wire type" to ("0801" to ""),
            "unknown length-delimited field" to ("a2060161" to ""),
            "unknown group" to ("a3060801a406" to ""),
            "maximum group depth" to ("a306".repeat(10001) + "a406".repeat(10001) to ""),
            "padded tag" to ("8a80808080000161" to "0a0161"),
            "last scalar wins" to ("0a01610a0162" to "0a0162"),
            "merge singular message" to ("3202100232021807" to "320410021807"),
            "missing map value" to ("3a030a0161" to "3a050a01611200"),
            "missing map key" to ("3a03120161" to "3a050a00120161"),
            "last map value wins" to ("3a060a01611201623a060a0161120163" to "3a060a0161120163"),
            "negative enum" to ("28ffffffffffffffffff01" to "28ffffffffffffffffff01"),
            "padded zero" to ("2880808080808080808000" to ""),
            "uint32 low bits" to ("320618ffffffff7f" to "320618ffffffff0f"),
            "leading BOM" to ("0a03efbbbf" to "0a03efbbbf"),
        )
        for ((reason, pair) in accepted) {
            assertContentEquals(fromHex(pair.second), encodeEnrichedLyric(decodeEnrichedLyric(fromHex(pair.first))), reason)
        }
        assertEquals(true, read(::decodeDocumentLineContent, fromHex("0a03308001")).words[0].emphasis)
    }

    @Test
    fun mergesRepeatedMessageChunksAndAppendsTheirLists() {
        val count = 2048
        val bytes = fromHex("32021002" + "32050a030a016b".repeat(count) + "32021807")
        val lyric = decodeEnrichedLyric(bytes)
        val meta = assertNotNull(lyric.meta)
        assertEquals(1, meta.offset)
        assertEquals(7L, meta.duration)
        assertEquals(List(count) { UnknownEntry(key = "k") }, meta.unknowns)
        assertEquals(lyric, decodeEnrichedLyric(encodeEnrichedLyric(lyric)))
    }

    @Test
    fun rejectsUnencodableStringsAndNumbers() {
        for (text in listOf("\uD800", "\uDC00", "x\uD800y")) {
            assertFailsWith<IllegalArgumentException> { encodeEnrichedLyric(Lyric(format = text)) }
            assertFailsWith<IllegalArgumentException> { encodeDocumentLyric(DocumentLyric(format = text)) }
        }
        for (duration in listOf(-1L, 4294967296L, Long.MAX_VALUE)) {
            assertFailsWith<IllegalArgumentException> { encodeEnrichedLyric(Lyric(meta = Meta(duration = duration))) }
            assertFailsWith<IllegalArgumentException> { encodeDocumentLyric(DocumentLyric(meta = Meta(duration = duration))) }
        }
    }

    @Test
    fun keepsConcurrentEncodesIndependent() {
        val executor = Executors.newFixedThreadPool(4)
        val barrier = CyclicBarrier(4)
        val lyrics = List(4) { index -> buildLyric().copy(format = ('a' + index).toString().repeat(8192)) }
        val expected = lyrics.map(::encodeEnrichedLyric)
        try {
            val futures = lyrics.mapIndexed { index, lyric ->
                executor.submit {
                    repeat(20) {
                        barrier.await(10, TimeUnit.SECONDS)
                        val bytes = encodeEnrichedLyric(lyric)
                        assertContentEquals(expected[index], bytes)
                        assertEquals(lyric, decodeEnrichedLyric(bytes))
                    }
                }
            }
            futures.forEach { it.get(30, TimeUnit.SECONDS) }
        } finally {
            executor.shutdownNow()
        }
    }

    private fun <T> checkMutations(value: T, encodeValue: (T) -> ByteArray, decodeValue: (ByteArray) -> T) {
        val random = Random(0x2545f491)
        val valid = encodeValue(value)
        repeat(1000) {
            val bytes = valid.copyOf()
            repeat(random.nextInt(1, 4)) { bytes[random.nextInt(bytes.size)] = random.nextInt(256).toByte() }
            val decoded = try {
                decodeValue(bytes)
            } catch (_: IllegalArgumentException) {
                return@repeat
            }
            assertEquals(decoded, decodeValue(encodeValue(decoded)))
        }
    }

    @Test
    fun roundTripsEveryAcceptedMutation() {
        checkMutations(buildLyric(), ::encodeEnrichedLyric, ::decodeEnrichedLyric)
        checkMutations(buildDocumentLyric(), ::encodeDocumentLyric, ::decodeDocumentLyric)
    }
}
