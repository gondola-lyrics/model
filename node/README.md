# Gondola Lyric Model For Node

Gondola Lyric Model TypeScript Binding.

## Installation

```bash
npm install @gondola-lyrics/model
```

## Usage

> [!IMPORTANT]
> This package is ESM-only.
> In your TS config, use `module: node20` / `module: nodenext` / `moduleResolution: bundler`.

- `timing` declares the timing precision of the original lyric:
  - `NONE`: No timing declared; every line is plain text.
  - `LINE`: Line-level; each line has one time range, and the content can only be plain text. `WORD` is not allowed. If any line needs word-level timing, use `WORD` instead.
  - `WORD`: Word-level; the content is a sequence of words, and each vocalized word carries its own time range. Plain text lines can also be mixed in. If the entire lyric consists of plain text lines, use `LINE` instead.

Annotations can carry their own timing independently of the original lyric's precision.

Model-specific helpers include `Document` or `Enriched` in their names and can be imported directly from the package.
The `/document` and `/enriched` entries expose the same model-specific names; shared helpers such as `makeTimeRange` are available from the root or `/common`.

Line romanizations use either `content.text` for whole-line text or `content.tokens` for source fragments, with at least one explicitly timed token.
Token text preserves whitespace and is joined without added separators; word romanizations retain their existing token structure.

```ts
import {
  makeDocumentLineAnnotationRoman,
  makeDocumentLineAnnotationRomanContentText,
  makeDocumentLineAnnotationRomanContentTokens,
  makeDocumentLineAnnotationRomanToken,
} from '@gondola-lyrics/model'

const plainRoman = makeDocumentLineAnnotationRoman({
  language: 'zh-latn',
  scheme: 'pinyin',
  content: makeDocumentLineAnnotationRomanContentText('ni hao'),
})

const timedRoman = makeDocumentLineAnnotationRoman({
  language: 'zh-latn',
  scheme: 'pinyin',
  content: makeDocumentLineAnnotationRomanContentTokens([
    makeDocumentLineAnnotationRomanToken({ time: { start: 1000, end: 1800 }, text: 'ni ' }),
    makeDocumentLineAnnotationRomanToken({ time: { start: 2000 }, text: 'hao' }),
  ]),
})
```

### Document Examples

```ts
import {
  TimingLevel,
  makeDocumentLineAnnotation,
  makeDocumentLineAnnotationTranslation,
  makeDocumentLineContentText,
  makeDocumentLineNormal,
  makeDocumentLyric,
  makeTimeRange,
  validateDocumentLyric,
} from '@gondola-lyrics/model'

// [02:50.644]Like the first time tangled by the fishing line
const persisted = makeDocumentLyric({
  format: 'lrc',
  timing: TimingLevel.LINE,
  lines: [
    makeDocumentLineNormal({
      // If end is omitted, the endpoint is unknown
      time: makeTimeRange({ start: 170644 }),
      languages: ['en'],
      content: makeDocumentLineContentText('Like the first time tangled by the fishing line'),
      // Translations go under annotation.translations, one per language
      annotation: makeDocumentLineAnnotation({
        translations: [makeDocumentLineAnnotationTranslation({ language: 'zh-Hans', text: '就像第一次被渔线缠住那样' })],
      }),
    }),
  ],
})

validateDocumentLyric(persisted) // => []
```

### Enriched Examples

```ts
import {
  EnrichedLyricStatus,
  TimingLevel,
  canonicalizeEnrichedLyric,
  decodeEnrichedLyric,
  deriveEnrichedLanguageUsages,
  encodeEnrichedLyric,
  getEnrichedLineContentText,
  makeEnrichedLineAnnotation,
  makeEnrichedLineAnnotationTranslation,
  makeEnrichedLineContentWords,
  makeEnrichedLineInstrumental,
  makeEnrichedLineNormal,
  makeEnrichedLyric,
  makeEnrichedWordNormal,
  makeEnrichedWordSpace,
  makeTimeRange,
  validateEnrichedLyric,
} from '@gondola-lyrics/model'

// Instrumental lines require a complete, non-empty time range.
const interlude = makeEnrichedLineInstrumental({
  time: makeTimeRange({ start: 176883, end: 178550 }),
})

// [02:58.550]I wish you are still by my side
const sung = makeEnrichedLineNormal({
  time: makeTimeRange({ start: 178550, end: 188199 }),
  languages: ['en'],
  content: makeEnrichedLineContentWords([
    makeEnrichedWordNormal({
      text: 'I',
      language: 'en',
      time: makeTimeRange({ start: 178550, end: 180198 }),
    }),
    // Space is used to declare a space; add as many as there are spaces
    makeEnrichedWordSpace({ text: ' ' }),
    makeEnrichedWordNormal({
      text: 'wish',
      language: 'en',
      time: makeTimeRange({ start: 180198, end: 181686 }),
    }),
    makeEnrichedWordSpace({ text: ' ' }),
    makeEnrichedWordNormal({
      text: 'you',
      language: 'en',
      time: makeTimeRange({ start: 181686, end: 184055 }),
    }),
    makeEnrichedWordSpace({ text: ' ' }),
    makeEnrichedWordNormal({
      text: 'are',
      language: 'en',
      time: makeTimeRange({ start: 184055, end: 184278 }),
    }),
    makeEnrichedWordSpace({ text: ' ' }),
    makeEnrichedWordNormal({
      text: 'still',
      language: 'en',
      time: makeTimeRange({ start: 184278, end: 184614 }),
    }),
    makeEnrichedWordSpace({ text: ' ' }),
    makeEnrichedWordNormal({
      text: 'by',
      language: 'en',
      time: makeTimeRange({ start: 184614, end: 184966 }),
    }),
    makeEnrichedWordSpace({ text: ' ' }),
    makeEnrichedWordNormal({
      text: 'my',
      language: 'en',
      time: makeTimeRange({ start: 184966, end: 185718 }),
    }),
    makeEnrichedWordSpace({ text: ' ' }),
    makeEnrichedWordNormal({
      text: 'side',
      language: 'en',
      time: makeTimeRange({ start: 185718, end: 188199 }),
    }),
  ]),
  annotation: makeEnrichedLineAnnotation({
    translations: [makeEnrichedLineAnnotationTranslation({ language: 'zh-Hans', text: '多希望你就在我身旁' })],
  }),
})

const played = makeEnrichedLyric({
  format: 'lrc',
  timing: TimingLevel.WORD,
  // Include the parser's status.
  status: EnrichedLyricStatus.VALID,
  // Language usages must match the declarations on normal lines and their normal words.
  languages: deriveEnrichedLanguageUsages([interlude, sung]),
  lines: [interlude, sung],
})

validateEnrichedLyric(played) // => []
getEnrichedLineContentText(sung.content) // => 'I wish you are still by my side'
decodeEnrichedLyric(encodeEnrichedLyric(canonicalizeEnrichedLyric(played))).lines.length // => 2
```

### Error Examples

```ts
import {
  EnrichedLyricStatus,
  TimingLevel,
  makeDocumentLineContentText,
  makeDocumentLineNormal,
  makeDocumentLyric,
  makeEnrichedLineContentWords,
  makeEnrichedLineNormal,
  makeEnrichedLyric,
  makeEnrichedWordNormal,
  makeTimeRange,
  validateDocumentLyric,
  validateEnrichedLyric,
} from '@gondola-lyrics/model'

// [02:43.908]I'm still figuring out my life
const brokenPersisted = makeDocumentLyric({
  format: 'lrc',
  // timing is not declared
  lines: [
    makeDocumentLineNormal({
      time: makeTimeRange({ start: 163908 }),
      languages: ['en'],
      content: makeDocumentLineContentText("I'm still figuring out my life"),
    }),
  ],
})

validateDocumentLyric(brokenPersisted)
// => [{ path: 'timing', code: 'lyric.timing.unspecified' }]

const brokenPlayed = makeEnrichedLyric({
  format: 'lrc',
  timing: TimingLevel.WORD,
  status: EnrichedLyricStatus.VALID,
  // languages is not declared
  lines: [
    makeEnrichedLineNormal({
      time: makeTimeRange({ start: 163908, end: 169347 }),
      languages: ['en'],
      content: makeEnrichedLineContentWords([
        makeEnrichedWordNormal({
          // The whole sentence is put into one word, with neither word splitting nor SPACE word separation
          text: "I'm still figuring out my life",
          language: 'en',
          time: makeTimeRange({ start: 163908, end: 169347 }),
        }),
      ]),
    }),
  ],
})

validateEnrichedLyric(brokenPlayed)
// => [
//      { path: 'languages', code: 'lyric.languages.mismatch' },
//      { path: 'lines[0].content.words[0].text', code: 'word.text.separator' },
//    ]
```

## Commands

**Generate**

Regenerates `src/generated` from `proto/`; requires buf 1.72.0 on the `PATH`.

```bash
python ../script/generate-proto-binding.py node
```

**Build**

```bash
npm run build
```

**Check**

```bash
npm run check
npm run format
```

**Test**

```bash
npm run test
```

## License

[MIT](../LICENSE)
