# Gondola Lyric Model For Kotlin

Gondola Lyric Model Kotlin binding.

## Installation

```kotlin
repositories {
    mavenCentral()
}

dependencies {
    implementation("io.github.gondola-lyrics:gondola-model:1.0.0")
}
```

The library targets Java 8 bytecode and provides native Kotlin data classes with a Protobuf wire codec.

## Usage

- `timing` declares the timing precision of the original lyric:
  - `TIMING_NONE`: No timing declared; every line is plain text.
  - `TIMING_LINE`: Each line has one time range and plain text content. Use `TIMING_WORD` if any line needs word-level timing.
  - `TIMING_WORD`: Normal words carry their own time ranges. Plain text lines may also appear; use `TIMING_LINE` if all lines are plain text.

Annotations can carry their own timing independently of the original lyric's precision.

Line romanizations use either `content.text` for whole-line text or `content.tokens` for source fragments, with at least one explicitly timed token.
Use `makeDocumentLineAnnotationRomanContentText` or `makeDocumentLineAnnotationRomanContentTokens` to select the content form; the enriched helpers use the corresponding `Enriched` names.
Token text preserves whitespace and is joined without added separators; word romanizations retain their existing token structure.

Messages expose immutable properties. Use data-class constructors or helpers to create values, and `copy()` to modify them.
Optional fields use nullable values: `null` means absent, while explicit `false` and zero values remain present.

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
            // If end is omitted, the endpoint is unknown.
            time = makeTimeRange(start = 170644),
            languages = listOf("en"),
            content = makeDocumentLineContentText("Like the first time tangled by the fishing line"),
            // Translations go under annotation.translations, one per language.
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
            // Separators are SPACE words of their own.
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
    // Include the parser's status.
    status = LyricStatus.LYRIC_STATUS_VALID,
    // Stored usages must match the declarations on normal lines and their normal words.
    languages = deriveEnrichedLanguageUsages(listOf(interlude, sung)),
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
    // Timing is not declared.
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
    // Languages are not declared.
    lines = listOf(
        makeEnrichedLineNormal(
            time = makeTimeRange(start = 163908, end = 169347),
            languages = listOf("en"),
            content = makeEnrichedLineContentWords(
                listOf(
                    makeEnrichedWordNormal(
                        // The sentence has not been split into normal words and SPACE separators.
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
// => [(languages, lyric.languages.mismatch), (lines[0].content.words[0].text, word.text.separator)]
```

API details are documented in the source comments. Download the matching `-sources.jar` in IntelliJ IDEA or Android Studio to read helper KDoc and generated model documentation. Field semantics are also available in the [Proto definitions](https://github.com/gondola-lyrics/model/tree/main/proto).

## Commands

**Generate**

```bash
python ../script/generate-proto-binding.py kotlin
```

**Build**

```bash
./gradlew build
```

**Check**

```bash
./gradlew check
./gradlew spotlessApply
```

**Test**

```bash
./gradlew test
```

## License

[MIT](https://github.com/gondola-lyrics/model/blob/main/LICENSE)
