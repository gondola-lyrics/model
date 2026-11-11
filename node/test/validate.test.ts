import { describe, it } from 'node:test'
import { deepStrictEqual } from 'node:assert/strict'

import { runtime, storage } from '@root/index'

const textLine = (start: number, end?: number): runtime.Line => {
  return runtime.makeLineNormal({ time: runtime.makeTimeRange({ start, end }), content: runtime.makeLineContentText('x') })
}

const lineTimed = (...lines: runtime.Line[]): runtime.Lyric => {
  return runtime.makeLyric({ format: 'lrc', timing: runtime.Timing.LINE, status: runtime.LyricStatus.VALID, lines })
}

describe('validate', () => {
  it('keys roman and ruby annotations by language and scheme', () => {
    const identities = [
      { language: 'JA-Latn', scheme: 'HEPBURN' },
      { language: 'ja-latn', scheme: 'kunrei' },
      { language: 'ja', scheme: 'hepburn' },
      { language: 'ja-latn', scheme: 'hepburn' },
      { language: 'ja-latn' },
      { language: 'JA-LATN', scheme: '' },
    ]
    const word = runtime.makeWordAnnotation({
      rubies: identities.map((identity) => runtime.makeWordAnnotationRuby(identity)),
      romans: identities.map((identity) => runtime.makeWordAnnotationRoman(identity)),
      translations: ['zh-Hans', 'ZH-HANS'].map((language) => runtime.makeWordAnnotationTranslation({ language, text: 'translation' })),
    })
    const line = runtime.makeLineAnnotation({
      romans: identities.map((identity) => runtime.makeLineAnnotationRoman({ ...identity, text: 'roman' })),
      translations: ['zh-Hans', 'ZH-HANS'].map((language) => runtime.makeLineAnnotationTranslation({ language, text: 'translation' })),
    })
    deepStrictEqual(runtime.validateWordAnnotation(word), [
      { path: 'rubies[3]', code: 'line.word.annotation.rubies.duplicate' },
      { path: 'rubies[5]', code: 'line.word.annotation.rubies.duplicate' },
      { path: 'romans[3]', code: 'line.word.annotation.romans.duplicate' },
      { path: 'romans[5]', code: 'line.word.annotation.romans.duplicate' },
      { path: 'translations[1]', code: 'line.word.annotation.translations.language.duplicate' },
    ])
    deepStrictEqual(runtime.validateLineAnnotation(line), [
      { path: 'romans[3]', code: 'line.annotation.romans.duplicate' },
      { path: 'romans[5]', code: 'line.annotation.romans.duplicate' },
      { path: 'translations[1]', code: 'line.annotation.translations.language.duplicate' },
    ])
  })

  it('validates annotation languages independently of scheme identifiers', () => {
    for (const language of ['ja-latn', 'ja_Latn']) {
      const identity = { language, scheme: 'custom_romanization' }
      const line = runtime.makeLineNormal({
        time: runtime.makeTimeRange({ start: 0, end: 1000 }),
        content: runtime.makeLineContentWords([
          runtime.makeWordNormal({
            text: 'x',
            time: runtime.makeTimeRange({ start: 0, end: 1000 }),
            annotation: runtime.makeWordAnnotation({
              rubies: [runtime.makeWordAnnotationRuby({ ...identity, tokens: [runtime.makeWordAnnotationToken({ text: 'shi' })] })],
              romans: [runtime.makeWordAnnotationRoman({ ...identity, tokens: [runtime.makeWordAnnotationToken({ text: 'shi' })] })],
            }),
          }),
        ]),
        annotation: runtime.makeLineAnnotation({ romans: [runtime.makeLineAnnotationRoman({ ...identity, text: 'shi' })] }),
      })
      const diagnostics = runtime.validateLine(line, '', runtime.Timing.WORD)
      deepStrictEqual(
        diagnostics.map((diagnostic) => [diagnostic.path, diagnostic.code]).sort(),
        language === 'ja-latn'
          ? []
          : [
              ['annotation.romans[0].language', 'language.tag.malformed'],
              ['content.words[0].annotation.romans[0].language', 'language.tag.malformed'],
              ['content.words[0].annotation.rubies[0].language', 'language.tag.malformed'],
            ],
      )
    }
  })

  it('accepts a word-level lyric', () => {
    const lines = [
      runtime.makeLineNormal({
        time: runtime.makeTimeRange({ start: 1000, end: 2000 }),
        languages: ['en'],
        content: runtime.makeLineContentWords([
          runtime.makeWordNormal({ text: 'hi', language: 'en', time: runtime.makeTimeRange({ start: 1000, end: 1500 }) }),
          runtime.makeWordSpace({ text: ' ' }),
          runtime.makeWordNormal({ text: 'there', language: 'en', time: runtime.makeTimeRange({ start: 1500, end: 2000 }) }),
        ]),
      }),
    ]
    const lyric = runtime.makeLyric({
      format: 'lrc',
      timing: runtime.Timing.WORD,
      status: runtime.LyricStatus.VALID,
      languages: runtime.deriveLanguageUsages(lines),
      lines,
    })
    deepStrictEqual(runtime.validateLyric(lyric), [])
  })

  // The codes are a contract the other bindings copy verbatim, so they are asserted as the strings they are.
  it('reports an undeclared timing', () => {
    const lyric = storage.makeLyric({
      format: 'lrc',
      lines: [
        storage.makeLineNormal({
          time: storage.makeTimeRange({ start: 1000 }),
          languages: ['en'],
          content: storage.makeLineContentText('hi there'),
        }),
      ],
    })
    deepStrictEqual(storage.validateLyric(lyric), [{ path: 'timing', code: 'lyric.timing.unspecified' }])
  })

  it('reports undeclared languages and an unsplit word', () => {
    const lyric = runtime.makeLyric({
      format: 'lrc',
      timing: runtime.Timing.WORD,
      status: runtime.LyricStatus.VALID,
      lines: [
        runtime.makeLineNormal({
          time: runtime.makeTimeRange({ start: 1000, end: 2000 }),
          languages: ['en'],
          content: runtime.makeLineContentWords([
            runtime.makeWordNormal({ text: 'hi there', language: 'en', time: runtime.makeTimeRange({ start: 1000, end: 2000 }) }),
          ]),
        }),
      ],
    })
    deepStrictEqual(runtime.validateLyric(lyric), [
      { path: 'languages', code: 'lyric.languages.mismatch' },
      { path: 'lines[0].content.words[0].text', code: 'word.text.separator' },
    ])
  })

  // An untimed lyric marks out no stretches, so it reports the line itself instead of asking it for a range it may not have.
  it('reports an instrumental line in an untimed lyric', () => {
    const lyric = runtime.makeLyric({
      format: 'lrc',
      timing: runtime.Timing.NONE,
      status: runtime.LyricStatus.VALID,
      lines: [runtime.makeLineInstrumental()],
    })
    deepStrictEqual(runtime.validateLyric(lyric), [{ path: 'lines[0].type', code: 'lyric.timing.none.instrumental' }])
  })

  // A line other than the last ends where the timeline moves on, so one left open would be shown for the rest of the song.
  it('reports a line left open above', () => {
    const lyric = lineTimed(textLine(0, 1000), textLine(1000), textLine(2000, 3000))
    deepStrictEqual(runtime.validateLyric(lyric), [{ path: 'lines[1].time.end', code: 'lyric.line.time.end.missing' }])
  })

  // Nothing in a lyric states where it stops, so the last line is the one line whose end the data cannot carry.
  it('accepts the last line left open above', () => {
    const lyric = lineTimed(textLine(0, 1000), textLine(1000, 2000), textLine(2000))
    deepStrictEqual(runtime.validateLyric(lyric), [])
  })

  // A line carrying no range at all is already reported for that, so it is not asked for an end on top.
  it('reports a line with no range once', () => {
    const lyric = lineTimed(runtime.makeLineNormal({ content: runtime.makeLineContentText('x') }), textLine(1000, 2000))
    deepStrictEqual(runtime.validateLyric(lyric), [{ path: 'lines[0].time', code: 'lyric.timing.line.time_missing' }])
  })

  // The two layers hold the same rule in two implementations, so the storage one is checked against the same case.
  it('reports a line left open above in the storage layer', () => {
    const lyric = storage.makeLyric({
      format: 'lrc',
      timing: storage.Timing.LINE,
      lines: [
        storage.makeLineNormal({ time: storage.makeTimeRange({ start: 0 }), content: storage.makeLineContentText('x') }),
        storage.makeLineNormal({ time: storage.makeTimeRange({ start: 1000, end: 2000 }), content: storage.makeLineContentText('y') }),
      ],
    })
    deepStrictEqual(storage.validateLyric(lyric), [{ path: 'lines[0].time.end', code: 'lyric.line.time.end.missing' }])
  })

  // Word-level timing still marks out each line, and a line carrying no range leaves its words with nothing to fall inside.
  it('reports a word-level line with no range', () => {
    const lines = [
      runtime.makeLineNormal({
        content: runtime.makeLineContentWords([runtime.makeWordNormal({ text: 'x', time: runtime.makeTimeRange({ start: 1000, end: 2000 }) })]),
      }),
    ]
    const lyric = runtime.makeLyric({ format: 'lrc', timing: runtime.Timing.WORD, status: runtime.LyricStatus.VALID, lines })
    deepStrictEqual(runtime.validateLyric(lyric), [{ path: 'lines[0].time', code: 'lyric.timing.line.time_missing' }])
  })
})
