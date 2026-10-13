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

### Storage Examples

```ts
import { storage } from '@gondola-lyrics/model'

// [02:50.644]Like the first time tangled by the fishing line
const persisted = storage.makeLyric({
  format: 'lrc',
  timing: storage.Timing.LINE,
  lines: [
    storage.makeLineNormal({
      // If end is omitted, the endpoint is unknown
      time: storage.makeTimeRange({ start: 170644 }),
      languages: ['en'],
      content: storage.makeLineContentText('Like the first time tangled by the fishing line'),
      // Translations go under annotation.translations, one per language
      annotation: storage.makeLineAnnotation({
        translations: [storage.makeLineAnnotationTranslation({ language: 'zh-Hans', text: '就像第一次被渔线缠住那样' })],
      }),
    }),
  ],
})

storage.validateLyric(persisted) // => []
```

### Runtime Examples

```ts
import { runtime } from '@gondola-lyrics/model'

// Only runtime can explicitly represent an interlude; just insert it between two lines, and it must have a complete time range
const interlude = runtime.makeLineInstrumental({
  time: runtime.makeTimeRange({ start: 176883, end: 178550 }),
})

// [02:58.550]I wish you are still by my side
const sung = runtime.makeLineNormal({
  time: runtime.makeTimeRange({ start: 178550, end: 188199 }),
  languages: ['en'],
  content: runtime.makeLineContentWords([
    runtime.makeWordNormal({
      text: 'I',
      language: 'en',
      time: runtime.makeTimeRange({ start: 178550, end: 180198 }),
    }),
    // Space is used to declare a space; add as many as there are spaces
    runtime.makeWordSpace({ text: ' ' }),
    runtime.makeWordNormal({
      text: 'wish',
      language: 'en',
      time: runtime.makeTimeRange({ start: 180198, end: 181686 }),
    }),
    runtime.makeWordSpace({ text: ' ' }),
    runtime.makeWordNormal({
      text: 'you',
      language: 'en',
      time: runtime.makeTimeRange({ start: 181686, end: 184055 }),
    }),
    runtime.makeWordSpace({ text: ' ' }),
    runtime.makeWordNormal({
      text: 'are',
      language: 'en',
      time: runtime.makeTimeRange({ start: 184055, end: 184278 }),
    }),
    runtime.makeWordSpace({ text: ' ' }),
    runtime.makeWordNormal({
      text: 'still',
      language: 'en',
      time: runtime.makeTimeRange({ start: 184278, end: 184614 }),
    }),
    runtime.makeWordSpace({ text: ' ' }),
    runtime.makeWordNormal({
      text: 'by',
      language: 'en',
      time: runtime.makeTimeRange({ start: 184614, end: 184966 }),
    }),
    runtime.makeWordSpace({ text: ' ' }),
    runtime.makeWordNormal({
      text: 'my',
      language: 'en',
      time: runtime.makeTimeRange({ start: 184966, end: 185718 }),
    }),
    runtime.makeWordSpace({ text: ' ' }),
    runtime.makeWordNormal({
      text: 'side',
      language: 'en',
      time: runtime.makeTimeRange({ start: 185718, end: 188199 }),
    }),
  ]),
  annotation: runtime.makeLineAnnotation({
    translations: [runtime.makeLineAnnotationTranslation({ language: 'zh-Hans', text: '多希望你就在我身旁' })],
  }),
})

const played = runtime.makeLyric({
  format: 'lrc',
  timing: runtime.Timing.WORD,
  // status is a runtime-only field
  status: runtime.LyricStatus.VALID,
  // languages is a derived field and must equal deriveLanguageUsages(lines), otherwise validateLyric will report an error
  languages: runtime.deriveLanguageUsages([interlude, sung]),
  lines: [interlude, sung],
})

runtime.validateLyric(played) // => []
runtime.getContentText(sung.content) // => 'I wish you are still by my side'
runtime.decode(runtime.encode(runtime.canonicalizeLyric(played))).lines.length // => 2
```

### Error Examples

```ts
import { runtime, storage } from '@gondola-lyrics/model'

// [02:43.908]I'm still figuring out my life
const brokenPersisted = storage.makeLyric({
  format: 'lrc',
  // timing is not declared
  lines: [
    storage.makeLineNormal({
      time: storage.makeTimeRange({ start: 163908 }),
      languages: ['en'],
      content: storage.makeLineContentText("I'm still figuring out my life"),
    }),
  ],
})

storage.validateLyric(brokenPersisted)
// => [{ path: 'timing', code: 'lyric.timing.unspecified' }]

const brokenPlayed = runtime.makeLyric({
  format: 'lrc',
  timing: runtime.Timing.WORD,
  status: runtime.LyricStatus.VALID,
  // languages is not declared
  lines: [
    runtime.makeLineNormal({
      time: runtime.makeTimeRange({ start: 163908, end: 169347 }),
      languages: ['en'],
      content: runtime.makeLineContentWords([
        runtime.makeWordNormal({
          // The whole sentence is put into one word, with neither word splitting nor SPACE word separation
          text: "I'm still figuring out my life",
          language: 'en',
          time: runtime.makeTimeRange({ start: 163908, end: 169347 }),
        }),
      ]),
    }),
  ],
})

runtime.validateLyric(brokenPlayed)
// => [
//      { path: 'languages', code: 'lyric.languages.mismatch' },
//      { path: 'lines[0].content.words[0].text', code: 'word.text.separator' },
//    ]
```

## Commands

**Generate**

```bash
npm run generate
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
