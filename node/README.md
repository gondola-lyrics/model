# Gondola Lyric Model For Node

Native TypeScript models, helpers, and Protobuf codecs for `document` and `enriched` lyrics.

## Installation

```bash
npm install @gondola-lyrics/model
```

## Usage

> [!IMPORTANT]
> This package is ESM-only.
> In your TS config, use `module: node20` / `module: nodenext` / `moduleResolution: bundler`.

- `timing` specifies the timing level of the original lyric:
  - `NONE`: Untimed; sung lines use whole-line text.
  - `LINE`: Each sung line has a time range and whole-line text. Use `WORD` if any line has word timing.
  - `WORD`: Normal words carry time ranges; whole-line text lines may also appear. Use `LINE` if all sung lines use whole-line text.

Annotations can carry timing independent of `timing`.

`document` stores source declarations; `enriched` adds parse `status` and `languageUsages` (`tag` and `lineCount`).
`Lyric.agents` defines agents, referenced from lines and backgrounds via `agentIds`.

Model-specific helpers include `Document` or `Enriched` in their names and are exported from both the package root and `/document` or `/enriched`.
Shared helpers such as `makeTimeRange` are exported from the root and `/common`.

Models are plain objects. Optional fields use `undefined`, while explicit `0` and `false` values are preserved.
`make*` helpers keep passed object and array references; use `validate*` to check constraints and `canonicalize*` to normalize copies.

Line romanizations use `content.text` for whole-line text or `content.tokens` for fragments (with at least one timed token).
Word romanizations and ruby annotations store fragments directly in `tokens`.
Fragments use `TextToken` (`time`, `text`, and `extra`); `language` and `scheme` are set on the parent annotation.
Token `text` keeps whitespace as-is and concatenates without extra separators.

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
      // The last timed line may omit `end`.
      time: makeTimeRange({ start: 170644 }),
      languages: ['en'],
      content: makeDocumentLineContentText('Like the first time tangled by the fishing line'),
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
    // Separate words with `SPACE` words.
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
  status: EnrichedLyricStatus.VALID,
  // Must match languages declared on normal lines and normal words.
  languageUsages: deriveEnrichedLanguageUsages([interlude, sung]),
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
  // Unset `timing` is reported rather than inferred.
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
  // Missing `languageUsages` is reported rather than derived.
  lines: [
    makeEnrichedLineNormal({
      time: makeTimeRange({ start: 163908, end: 169347 }),
      languages: ['en'],
      content: makeEnrichedLineContentWords([
        makeEnrichedWordNormal({
          // `NORMAL` words cannot contain whitespace.
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
//      { path: 'languageUsages', code: 'lyric.language_usages.mismatch' },
//      { path: 'lines[0].content.words[0].text', code: 'word.text.separator' },
//    ]
```

### Line Romanization Examples

```ts
import {
  getDocumentLineAnnotationRomanText,
  makeDocumentLineAnnotationRoman,
  makeDocumentLineAnnotationRomanContentText,
  makeDocumentLineAnnotationRomanContentTokens,
  makeTextToken,
  makeTimeRange,
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
    makeTextToken({ time: makeTimeRange({ start: 1000, end: 1800 }), text: 'ni ', extra: { source: 'parser' } }),
    makeTextToken({ time: makeTimeRange({ start: 2000 }), text: 'hao' }),
  ]),
})

getDocumentLineAnnotationRomanText(plainRoman) // => 'ni hao'
getDocumentLineAnnotationRomanText(timedRoman) // => 'ni hao'
```

### Word Romanization Views

`deriveDocumentLineRomanViews` and `deriveEnrichedLineRomanViews` merge word romanizations into `LineRomanView` items (`language`, `scheme`, and `text`) for display.
Token timing and boundaries stay on the word annotations, and line-level romanizations remain in `line.annotation.romans`.

```ts
import type { LineRomanView } from '@gondola-lyrics/model'

import {
  deriveDocumentLineRomanViews,
  makeDocumentLineContentWords,
  makeDocumentWordAnnotation,
  makeDocumentWordAnnotationRoman,
  makeDocumentWordNormal,
  makeTextToken,
  makeTimeRange,
  pickItemByLanguage,
  pickItemByScheme,
} from '@gondola-lyrics/model'

const content = makeDocumentLineContentWords([
  makeDocumentWordNormal({
    text: '你好',
    language: 'zh',
    time: makeTimeRange({ start: 1000, end: 2600 }),
    annotation: makeDocumentWordAnnotation({
      romans: [
        makeDocumentWordAnnotationRoman({
          language: 'zh-Latn',
          scheme: 'pinyin',
          tokens: [
            makeTextToken({ text: 'ni ', time: makeTimeRange({ start: 1000, end: 1800 }) }),
            makeTextToken({ text: 'hao', time: makeTimeRange({ start: 2000, end: 2600 }) }),
          ],
        }),
        makeDocumentWordAnnotationRoman({
          language: 'zh-Latn',
          scheme: 'pinyin-numeric',
          tokens: [makeTextToken({ text: 'ni3 hao3' })],
        }),
      ],
    }),
  }),
])

const views: LineRomanView[] = deriveDocumentLineRomanViews(content)
// => [
//      { language: 'zh-latn', scheme: 'pinyin', text: 'ni hao' },
//      { language: 'zh-latn', scheme: 'pinyin-numeric', text: 'ni3 hao3' },
//    ]

pickItemByLanguage(views, ['zh-Latn', 'en'])?.text // => 'ni hao'
pickItemByScheme(views, { scheme: 'pinyin-numeric', languages: ['zh-Latn', 'en'] })?.text // => 'ni3 hao3'
```

Language preferences are matched in order; untagged items are used only if no preference matches.
`pickItemByScheme` filters by case-insensitive `scheme` first, then applies language matching and `fallback` within the filtered items.
`scheme: undefined` skips scheme filtering; `scheme: ''` matches items without a scheme.

## Commands

**Generate**

Regenerates `src/generated` from `proto/`; requires buf 1.72.0 on `PATH`.

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
