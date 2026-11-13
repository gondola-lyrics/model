# Gondola Lyric Model For Kotlin

Native Kotlin models, helpers, Java-compatible APIs, and Protobuf codecs for `document` and `enriched` lyrics.

## Installation

```kotlin
repositories {
    mavenCentral()
}

dependencies {
    implementation("io.github.gondola-lyrics:gondola-model:<version>")
}
```

Targets Java 8 bytecode and provides Kotlin data classes with Protobuf codecs.

## Usage

- `timing` specifies the timing level of the original lyric:
  - `TimingLevel.TIMING_LEVEL_NONE`: Untimed; sung lines use whole-line text.
  - `TimingLevel.TIMING_LEVEL_LINE`: Each sung line has a time range and whole-line text. Use `TIMING_LEVEL_WORD` if any line has word timing.
  - `TimingLevel.TIMING_LEVEL_WORD`: Normal words carry time ranges; whole-line text lines may also appear. Use `TIMING_LEVEL_LINE` if all sung lines use whole-line text.

Annotations can carry timing independent of `timing`.

`document` stores source declarations; `enriched` adds parse `status` and `languageUsages` (`tag` and `lineCount`).
`Lyric.agents` defines agents, referenced from lines and backgrounds via `agentIds`.
Model-specific helpers include `Document` or `Enriched` in their names and are imported from their respective packages.

Line romanizations use `content.text` for whole-line text or `content.tokens` for fragments (with at least one timed token), built via `make*LineAnnotationRomanContentText` or `make*LineAnnotationRomanContentTokens`.
Word romanizations and ruby annotations store fragments directly in `tokens`.
Fragments use `TextToken` (nullable `time`, `text`, and `extra`); `language` and `scheme` are set on the parent annotation.
Token `text` keeps whitespace as-is and concatenates without extra separators.

Models are data classes with `val` properties; create instances with constructors or `make*` helpers, and update them with `copy()`.
`List` and `Map` properties use read-only interfaces, and constructors or `copy()` may keep passed collection references.
Optional fields are nullable: `null` means unset, while explicit `0` and `false` values are preserved.
Enums wrap an `Int` `value` with predefined constants so unknown wire numbers are retained.

### Document Examples

```kotlin
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.document.makeDocumentLineAnnotation
import gondola.lyrics.model.document.makeDocumentLineAnnotationTranslation
import gondola.lyrics.model.document.makeDocumentLineContentText
import gondola.lyrics.model.document.makeDocumentLineNormal
import gondola.lyrics.model.document.makeDocumentLyric
import gondola.lyrics.model.document.validateDocumentLyric

val persisted = makeDocumentLyric(
    format = "lrc",
    timing = TimingLevel.TIMING_LEVEL_LINE,
    lines = listOf(
        makeDocumentLineNormal(
            // The last timed line may omit `end`.
            time = makeTimeRange(start = 170644),
            languages = listOf("en"),
            content = makeDocumentLineContentText("Like the first time tangled by the fishing line"),
            annotation = makeDocumentLineAnnotation(
                translations = listOf(
                    makeDocumentLineAnnotationTranslation(language = "zh-Hans", text = "就像第一次被渔线缠住那样"),
                ),
            ),
        ),
    ),
)

validateDocumentLyric(persisted) // => []
```

### Enriched Examples

```kotlin
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.enriched.canonicalizeEnrichedLyric
import gondola.lyrics.model.enriched.decodeEnrichedLyric
import gondola.lyrics.model.enriched.deriveEnrichedLanguageUsages
import gondola.lyrics.model.enriched.encodeEnrichedLyric
import gondola.lyrics.model.enriched.getEnrichedLineContentText
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotation
import gondola.lyrics.model.enriched.makeEnrichedLineAnnotationTranslation
import gondola.lyrics.model.enriched.makeEnrichedLineContentWords
import gondola.lyrics.model.enriched.makeEnrichedLineInstrumental
import gondola.lyrics.model.enriched.makeEnrichedLineNormal
import gondola.lyrics.model.enriched.makeEnrichedLyric
import gondola.lyrics.model.enriched.makeEnrichedWordNormal
import gondola.lyrics.model.enriched.makeEnrichedWordSpace
import gondola.lyrics.model.enriched.validateEnrichedLyric

// Instrumental lines require a complete, non-empty time range.
val interlude = makeEnrichedLineInstrumental(
    time = makeTimeRange(start = 176883, end = 178550),
)

val sung = makeEnrichedLineNormal(
    time = makeTimeRange(start = 178550, end = 188199),
    languages = listOf("en"),
    content = makeEnrichedLineContentWords(
        listOf(
            makeEnrichedWordNormal(
                text = "I",
                language = "en",
                time = makeTimeRange(start = 178550, end = 180198),
            ),
            // Separate words with `SPACE` words.
            makeEnrichedWordSpace(text = " "),
            makeEnrichedWordNormal(
                text = "wish",
                language = "en",
                time = makeTimeRange(start = 180198, end = 181686),
            ),
            makeEnrichedWordSpace(text = " "),
            makeEnrichedWordNormal(
                text = "you",
                language = "en",
                time = makeTimeRange(start = 181686, end = 184055),
            ),
            makeEnrichedWordSpace(text = " "),
            makeEnrichedWordNormal(
                text = "are",
                language = "en",
                time = makeTimeRange(start = 184055, end = 184278),
            ),
            makeEnrichedWordSpace(text = " "),
            makeEnrichedWordNormal(
                text = "still",
                language = "en",
                time = makeTimeRange(start = 184278, end = 184614),
            ),
            makeEnrichedWordSpace(text = " "),
            makeEnrichedWordNormal(
                text = "by",
                language = "en",
                time = makeTimeRange(start = 184614, end = 184966),
            ),
            makeEnrichedWordSpace(text = " "),
            makeEnrichedWordNormal(
                text = "my",
                language = "en",
                time = makeTimeRange(start = 184966, end = 185718),
            ),
            makeEnrichedWordSpace(text = " "),
            makeEnrichedWordNormal(
                text = "side",
                language = "en",
                time = makeTimeRange(start = 185718, end = 188199),
            ),
        ),
    ),
    annotation = makeEnrichedLineAnnotation(
        translations = listOf(
            makeEnrichedLineAnnotationTranslation(language = "zh-Hans", text = "多希望你就在我身旁"),
        ),
    ),
)

val played = makeEnrichedLyric(
    format = "lrc",
    timing = TimingLevel.TIMING_LEVEL_WORD,
    status = LyricStatus.LYRIC_STATUS_VALID,
    // Must match languages declared on normal lines and normal words.
    languageUsages = deriveEnrichedLanguageUsages(listOf(interlude, sung)),
    lines = listOf(interlude, sung),
)

validateEnrichedLyric(played) // => []
getEnrichedLineContentText(sung.content) // => "I wish you are still by my side"
decodeEnrichedLyric(encodeEnrichedLyric(canonicalizeEnrichedLyric(played))).lines.size // => 2
```

### Error Examples

```kotlin
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.TimingLevel
import gondola.lyrics.model.document.makeDocumentLineContentText
import gondola.lyrics.model.document.makeDocumentLineNormal
import gondola.lyrics.model.document.makeDocumentLyric
import gondola.lyrics.model.document.validateDocumentLyric
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.makeEnrichedLineContentWords
import gondola.lyrics.model.enriched.makeEnrichedLineNormal
import gondola.lyrics.model.enriched.makeEnrichedLyric
import gondola.lyrics.model.enriched.makeEnrichedWordNormal
import gondola.lyrics.model.enriched.validateEnrichedLyric

val brokenPersisted = makeDocumentLyric(
    format = "lrc",
    // Unset `timing` is reported rather than inferred.
    lines = listOf(
        makeDocumentLineNormal(
            time = makeTimeRange(start = 163908),
            languages = listOf("en"),
            content = makeDocumentLineContentText("I'm still figuring out my life"),
        ),
    ),
)

validateDocumentLyric(brokenPersisted).map { it.path to it.code.value }
// => [(timing, lyric.timing.unspecified)]

val brokenPlayed = makeEnrichedLyric(
    format = "lrc",
    timing = TimingLevel.TIMING_LEVEL_WORD,
    status = LyricStatus.LYRIC_STATUS_VALID,
    // Missing `languageUsages` is reported rather than derived.
    lines = listOf(
        makeEnrichedLineNormal(
            time = makeTimeRange(start = 163908, end = 169347),
            languages = listOf("en"),
            content = makeEnrichedLineContentWords(
                listOf(
                    makeEnrichedWordNormal(
                        // `NORMAL` words cannot contain whitespace.
                        text = "I'm still figuring out my life",
                        language = "en",
                        time = makeTimeRange(start = 163908, end = 169347),
                    ),
                ),
            ),
        ),
    ),
)

validateEnrichedLyric(brokenPlayed).map { it.path to it.code.value }
// => [(languageUsages, lyric.language_usages.mismatch), (lines[0].content.words[0].text, word.text.separator)]
```

### Line Romanization Examples

```kotlin
import gondola.lyrics.model.common.makeTextToken
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.document.getDocumentLineAnnotationRomanText
import gondola.lyrics.model.document.makeDocumentLineAnnotationRoman
import gondola.lyrics.model.document.makeDocumentLineAnnotationRomanContentText
import gondola.lyrics.model.document.makeDocumentLineAnnotationRomanContentTokens

val plainRoman = makeDocumentLineAnnotationRoman(
    language = "zh-latn",
    scheme = "pinyin",
    content = makeDocumentLineAnnotationRomanContentText("ni hao"),
)

val timedRoman = makeDocumentLineAnnotationRoman(
    language = "zh-latn",
    scheme = "pinyin",
    content = makeDocumentLineAnnotationRomanContentTokens(
        listOf(
            makeTextToken(text = "ni ", time = makeTimeRange(start = 1000, end = 1800), extra = mapOf("source" to "parser")),
            makeTextToken(text = "hao", time = makeTimeRange(start = 2000)),
        ),
    ),
)

getDocumentLineAnnotationRomanText(plainRoman) // => "ni hao"
getDocumentLineAnnotationRomanText(timedRoman) // => "ni hao"
```

### Word Romanization Views

`deriveDocumentLineRomanViews` and `deriveEnrichedLineRomanViews` merge word romanizations into `LineRomanView` items (`language`, `scheme`, and `text`) for display.
Token timing and boundaries stay on the word annotations, and line-level romanizations remain in `line.annotation.romans`.

```kotlin
import gondola.lyrics.model.common.LineRomanView
import gondola.lyrics.model.common.SchemePreference
import gondola.lyrics.model.common.makeTextToken
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.pickItemByLanguage
import gondola.lyrics.model.common.pickItemByScheme
import gondola.lyrics.model.document.deriveDocumentLineRomanViews
import gondola.lyrics.model.document.makeDocumentLineContentWords
import gondola.lyrics.model.document.makeDocumentWordAnnotation
import gondola.lyrics.model.document.makeDocumentWordAnnotationRoman
import gondola.lyrics.model.document.makeDocumentWordNormal
import gondola.lyrics.model.document.pickDocumentItemByLanguage

val content = makeDocumentLineContentWords(
    listOf(
        makeDocumentWordNormal(
            text = "你好",
            language = "zh",
            time = makeTimeRange(start = 1000, end = 2600),
            annotation = makeDocumentWordAnnotation(
                romans = listOf(
                    makeDocumentWordAnnotationRoman(
                        language = "zh-Latn",
                        scheme = "pinyin",
                        tokens = listOf(
                            makeTextToken(text = "ni ", time = makeTimeRange(start = 1000, end = 1800)),
                            makeTextToken(text = "hao", time = makeTimeRange(start = 2000, end = 2600)),
                        ),
                    ),
                    makeDocumentWordAnnotationRoman(
                        language = "zh-Latn",
                        scheme = "pinyin-numeric",
                        tokens = listOf(makeTextToken(text = "ni3 hao3")),
                    ),
                ),
            ),
        ),
    ),
)

val views: List<LineRomanView> = deriveDocumentLineRomanViews(content)
// => [
//      LineRomanView(language=zh-latn, scheme=pinyin, text=ni hao),
//      LineRomanView(language=zh-latn, scheme=pinyin-numeric, text=ni3 hao3),
//    ]

pickItemByLanguage(views, listOf("zh-Latn", "en")) { it.language }?.text // => "ni hao"

val selected = pickItemByScheme(
    items = views,
    preference = SchemePreference(scheme = "pinyin-numeric", languages = listOf("zh-Latn", "en")),
    languageOf = { it.language },
    schemeOf = { it.scheme },
)
selected?.text // => "ni3 hao3"

val romans = content.words.single().annotation?.romans.orEmpty()
pickDocumentItemByLanguage(romans, listOf("zh-Latn", "en"))?.scheme // => "pinyin"
```

`pickDocumentItemByLanguage` and `pickEnrichedItemByLanguage` accept a single language or an ordered list of language preferences.
Language preferences are matched in order; untagged items are used only if no preference matches.
`pickItemByScheme` filters by case-insensitive `scheme` first, then applies language matching and `fallback` within the filtered items.
`scheme = null` skips scheme filtering; `scheme = ""` matches items without a scheme.

API documentation is available in `-sources.jar` (KDoc) and the [Proto definitions](https://github.com/gondola-lyrics/model/tree/main/proto).

## Commands

**Generate**

Regenerates `src/generated/kotlin` from `proto/`; requires buf 1.72.0 on `PATH`.

```bash
python ../script/generate-proto-binding.py kotlin
```

**Build**

```bash
bash ./gradlew build
```

**Check**

```bash
bash ./gradlew check
bash ./gradlew spotlessApply
```

**Test**

```bash
bash ./gradlew test
```

## License

[MIT](https://github.com/gondola-lyrics/model/blob/main/LICENSE)
