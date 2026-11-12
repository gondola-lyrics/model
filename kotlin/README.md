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

- `timing` determines the time precision of the entire lyric:
  - `TIMING_NONE`: No timing declared; every line is plain text.
  - `TIMING_LINE`: Each line has one time range and plain text content. Use `TIMING_WORD` if any line needs word-level timing.
  - `TIMING_WORD`: Normal words carry their own time ranges. Plain text lines may also appear; use `TIMING_LINE` if all lines are plain text.

Messages expose immutable properties. Use data-class constructors or helpers to create values, and `copy()` to modify them.
Optional fields use nullable values: `null` means absent, while explicit `false` and zero values remain present.

### Document Examples

```kotlin
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.document.makeLineAnnotation
import gondola.lyrics.model.document.makeLineAnnotationTranslation
import gondola.lyrics.model.document.makeLineContentText
import gondola.lyrics.model.document.makeLineNormal
import gondola.lyrics.model.document.makeLyric
import gondola.lyrics.model.document.validateLyric

val persisted = makeLyric(
    format = "lrc",
    timing = Timing.TIMING_LINE,
    lines = listOf(
        makeLineNormal(
            // If end is omitted, the endpoint is unknown.
            time = makeTimeRange(start = 170644),
            languages = listOf("en"),
            content = makeLineContentText("Like the first time tangled by the fishing line"),
            // Translations go under annotation.translations, one per language.
            annotation = makeLineAnnotation(
                translations = listOf(
                    makeLineAnnotationTranslation(language = "zh-Hans", text = "就像第一次被渔线缠住那样"),
                ),
            ),
        ),
    ),
)

validateLyric(persisted) // => []
```

### Enriched Examples

```kotlin
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.enriched.canonicalizeLyric
import gondola.lyrics.model.enriched.decode
import gondola.lyrics.model.enriched.deriveLanguageUsages
import gondola.lyrics.model.enriched.encode
import gondola.lyrics.model.enriched.getContentText
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.makeLineAnnotation
import gondola.lyrics.model.enriched.makeLineAnnotationTranslation
import gondola.lyrics.model.enriched.makeLineContentWords
import gondola.lyrics.model.enriched.makeLineInstrumental
import gondola.lyrics.model.enriched.makeLineNormal
import gondola.lyrics.model.enriched.makeLyric
import gondola.lyrics.model.enriched.makeWordNormal
import gondola.lyrics.model.enriched.makeWordSpace
import gondola.lyrics.model.enriched.validateLyric

// Instrumental lines require a complete, non-empty time range.
val interlude = makeLineInstrumental(
    time = makeTimeRange(start = 176883, end = 178550),
)

val sung = makeLineNormal(
    time = makeTimeRange(start = 178550, end = 188199),
    languages = listOf("en"),
    content = makeLineContentWords(
        listOf(
            makeWordNormal(
                text = "I",
                language = "en",
                time = makeTimeRange(start = 178550, end = 180198),
            ),
            // Separators are SPACE words of their own.
            makeWordSpace(text = " "),
            makeWordNormal(
                text = "wish",
                language = "en",
                time = makeTimeRange(start = 180198, end = 181686),
            ),
            makeWordSpace(text = " "),
            makeWordNormal(
                text = "you",
                language = "en",
                time = makeTimeRange(start = 181686, end = 184055),
            ),
            makeWordSpace(text = " "),
            makeWordNormal(
                text = "are",
                language = "en",
                time = makeTimeRange(start = 184055, end = 184278),
            ),
            makeWordSpace(text = " "),
            makeWordNormal(
                text = "still",
                language = "en",
                time = makeTimeRange(start = 184278, end = 184614),
            ),
            makeWordSpace(text = " "),
            makeWordNormal(
                text = "by",
                language = "en",
                time = makeTimeRange(start = 184614, end = 184966),
            ),
            makeWordSpace(text = " "),
            makeWordNormal(
                text = "my",
                language = "en",
                time = makeTimeRange(start = 184966, end = 185718),
            ),
            makeWordSpace(text = " "),
            makeWordNormal(
                text = "side",
                language = "en",
                time = makeTimeRange(start = 185718, end = 188199),
            ),
        ),
    ),
    annotation = makeLineAnnotation(
        translations = listOf(
            makeLineAnnotationTranslation(language = "zh-Hans", text = "多希望你就在我身旁"),
        ),
    ),
)

val played = makeLyric(
    format = "lrc",
    timing = Timing.TIMING_WORD,
    // Include the parser's status.
    status = LyricStatus.LYRIC_STATUS_VALID,
    // Stored usages must match the declarations on normal lines and their normal words.
    languages = deriveLanguageUsages(listOf(interlude, sung)),
    lines = listOf(interlude, sung),
)

validateLyric(played) // => []
getContentText(sung.content) // => "I wish you are still by my side"
decode(encode(canonicalizeLyric(played))).lines.size // => 2
```

### Error Examples

```kotlin
import gondola.lyrics.model.common.makeTimeRange
import gondola.lyrics.model.common.Timing
import gondola.lyrics.model.document.makeLineContentText
import gondola.lyrics.model.document.makeLineNormal as makeDocumentLine
import gondola.lyrics.model.document.makeLyric as makeDocumentLyric
import gondola.lyrics.model.document.validateLyric as validateDocumentLyric
import gondola.lyrics.model.enriched.LyricStatus
import gondola.lyrics.model.enriched.makeLineContentWords
import gondola.lyrics.model.enriched.makeLineNormal as makeEnrichedLine
import gondola.lyrics.model.enriched.makeLyric as makeEnrichedLyric
import gondola.lyrics.model.enriched.makeWordNormal
import gondola.lyrics.model.enriched.validateLyric as validateEnrichedLyric

val brokenPersisted = makeDocumentLyric(
    format = "lrc",
    // Timing is not declared.
    lines = listOf(
        makeDocumentLine(
            time = makeTimeRange(start = 163908),
            languages = listOf("en"),
            content = makeLineContentText("I'm still figuring out my life"),
        ),
    ),
)

validateDocumentLyric(brokenPersisted).map { it.path to it.code.value }
// => [(timing, lyric.timing.unspecified)]

val brokenPlayed = makeEnrichedLyric(
    format = "lrc",
    timing = Timing.TIMING_WORD,
    status = LyricStatus.LYRIC_STATUS_VALID,
    // Languages are not declared.
    lines = listOf(
        makeEnrichedLine(
            time = makeTimeRange(start = 163908, end = 169347),
            languages = listOf("en"),
            content = makeLineContentWords(
                listOf(
                    makeWordNormal(
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
