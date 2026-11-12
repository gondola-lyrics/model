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

- `timing` determines the time precision of the entire lyric and which fields carry time:
  - `NONE`: No timing declared; every line is plain text.
  - `LINE`: Line-level; each line has one time range, and the content can only be plain text. `WORD` is not allowed. If any line needs word-level timing, use `WORD` instead.
  - `WORD`: Word-level; the content is a sequence of words, and each vocalized word carries its own time range. Plain text lines can also be mixed in. If the entire lyric consists of plain text lines, use `LINE` instead.

### Document Examples

```ts
import { document } from '@gondola-lyrics/model'

// [02:50.644]Like the first time tangled by the fishing line
const persisted = document.makeLyric({
  format: 'lrc',
  timing: document.Timing.LINE,
  lines: [
    document.makeLineNormal({
      // If end is omitted, the endpoint is unknown
      time: document.makeTimeRange({ start: 170644 }),
      languages: ['en'],
      content: document.makeLineContentText('Like the first time tangled by the fishing line'),
      // Translations go under annotation.translations, one per language
      annotation: document.makeLineAnnotation({
        translations: [document.makeLineAnnotationTranslation({ language: 'zh-Hans', text: '就像第一次被渔线缠住那样' })],
      }),
    }),
  ],
})

document.validateLyric(persisted) // => []
```

### Enriched Examples

```ts
import { enriched } from '@gondola-lyrics/model'

// Both document and enriched support interludes with a complete, non-empty time range.
// Document preserves interludes stated by the source; enriched can also carry interludes derived from timeline gaps.
const interlude = enriched.makeLineInstrumental({
  time: enriched.makeTimeRange({ start: 176883, end: 178550 }),
})

// [02:58.550]I wish you are still by my side
const sung = enriched.makeLineNormal({
  time: enriched.makeTimeRange({ start: 178550, end: 188199 }),
  languages: ['en'],
  content: enriched.makeLineContentWords([
    enriched.makeWordNormal({
      text: 'I',
      language: 'en',
      time: enriched.makeTimeRange({ start: 178550, end: 180198 }),
    }),
    // Space is used to declare a space; add as many as there are spaces
    enriched.makeWordSpace({ text: ' ' }),
    enriched.makeWordNormal({
      text: 'wish',
      language: 'en',
      time: enriched.makeTimeRange({ start: 180198, end: 181686 }),
    }),
    enriched.makeWordSpace({ text: ' ' }),
    enriched.makeWordNormal({
      text: 'you',
      language: 'en',
      time: enriched.makeTimeRange({ start: 181686, end: 184055 }),
    }),
    enriched.makeWordSpace({ text: ' ' }),
    enriched.makeWordNormal({
      text: 'are',
      language: 'en',
      time: enriched.makeTimeRange({ start: 184055, end: 184278 }),
    }),
    enriched.makeWordSpace({ text: ' ' }),
    enriched.makeWordNormal({
      text: 'still',
      language: 'en',
      time: enriched.makeTimeRange({ start: 184278, end: 184614 }),
    }),
    enriched.makeWordSpace({ text: ' ' }),
    enriched.makeWordNormal({
      text: 'by',
      language: 'en',
      time: enriched.makeTimeRange({ start: 184614, end: 184966 }),
    }),
    enriched.makeWordSpace({ text: ' ' }),
    enriched.makeWordNormal({
      text: 'my',
      language: 'en',
      time: enriched.makeTimeRange({ start: 184966, end: 185718 }),
    }),
    enriched.makeWordSpace({ text: ' ' }),
    enriched.makeWordNormal({
      text: 'side',
      language: 'en',
      time: enriched.makeTimeRange({ start: 185718, end: 188199 }),
    }),
  ]),
  annotation: enriched.makeLineAnnotation({
    translations: [enriched.makeLineAnnotationTranslation({ language: 'zh-Hans', text: '多希望你就在我身旁' })],
  }),
})

const played = enriched.makeLyric({
  format: 'lrc',
  timing: enriched.Timing.WORD,
  // status is a enriched-only field
  status: enriched.LyricStatus.VALID,
  // languages is a derived field and must equal deriveLanguageUsages(lines), otherwise validateLyric will report an error
  languages: enriched.deriveLanguageUsages([interlude, sung]),
  lines: [interlude, sung],
})

enriched.validateLyric(played) // => []
enriched.getContentText(sung.content) // => 'I wish you are still by my side'
enriched.decode(enriched.encode(enriched.canonicalizeLyric(played))).lines.length // => 2
```

### Error Examples

```ts
import { enriched, document } from '@gondola-lyrics/model'

// [02:43.908]I'm still figuring out my life
const brokenPersisted = document.makeLyric({
  format: 'lrc',
  // timing is not declared
  lines: [
    document.makeLineNormal({
      time: document.makeTimeRange({ start: 163908 }),
      languages: ['en'],
      content: document.makeLineContentText("I'm still figuring out my life"),
    }),
  ],
})

document.validateLyric(brokenPersisted)
// => [{ path: 'timing', code: 'lyric.timing.unspecified' }]

const brokenPlayed = enriched.makeLyric({
  format: 'lrc',
  timing: enriched.Timing.WORD,
  status: enriched.LyricStatus.VALID,
  // languages is not declared
  lines: [
    enriched.makeLineNormal({
      time: enriched.makeTimeRange({ start: 163908, end: 169347 }),
      languages: ['en'],
      content: enriched.makeLineContentWords([
        enriched.makeWordNormal({
          // The whole sentence is put into one word, with neither word splitting nor SPACE word separation
          text: "I'm still figuring out my life",
          language: 'en',
          time: enriched.makeTimeRange({ start: 163908, end: 169347 }),
        }),
      ]),
    }),
  ],
})

enriched.validateLyric(brokenPlayed)
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
