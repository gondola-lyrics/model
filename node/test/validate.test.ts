import { describe, it } from 'node:test'
import { deepStrictEqual } from 'node:assert/strict'

import { enriched, document } from '@root/index'

const textLine = (start: number, end?: number): enriched.Line => {
  return enriched.makeLineNormal({ time: enriched.makeTimeRange({ start, end }), content: enriched.makeLineContentText('x') })
}

const lineTimed = (...lines: enriched.Line[]): enriched.Lyric => {
  return enriched.makeLyric({ format: 'lrc', timing: enriched.Timing.LINE, status: enriched.LyricStatus.VALID, lines })
}

const validatePartsInBothLayers = (parts: (enriched.Part | undefined)[]): enriched.Diagnostic[][] => {
  const played = enriched.makeLyric({
    timing: enriched.Timing.NONE,
    status: enriched.LyricStatus.VALID,
    lines: parts.map((part) => enriched.makeLineNormal({ part, content: enriched.makeLineContentText('line') })),
  })
  const stored = document.makeLyric({
    timing: document.Timing.NONE,
    lines: parts.map((part) => document.makeLineNormal({ part, content: document.makeLineContentText('line') })),
  })
  return [enriched.validateLyric(played), document.validateLyric(stored)]
}

describe('validate', () => {
  it('requires an emphasis decision when its origin is set', () => {
    for (const derived of [false, true]) {
      const line = enriched.makeLineNormal({
        time: enriched.makeTimeRange({ start: 1000, end: 5000 }),
        content: enriched.makeLineContentWords([
          enriched.makeWordNormal({
            text: 'ah',
            time: enriched.makeTimeRange({ start: 1000, end: 5000 }),
            emphasis: enriched.makeWordEmphasis({ derived }),
          }),
        ]),
      })
      const lyric = enriched.canonicalizeLyric(
        enriched.makeLyric({ timing: enriched.Timing.WORD, status: enriched.LyricStatus.VALID, lines: [line] }),
      )
      deepStrictEqual(enriched.validateLyric(lyric), [{ path: 'lines[0].content.words[0].emphasis.value', code: 'line.word.emphasis.value.missing' }])
      for (const value of [false, true]) {
        const word = enriched.makeWordNormal({ text: 'ah', emphasis: enriched.makeWordEmphasis({ value, derived }) })
        deepStrictEqual(enriched.validateWord(word), [])
      }
    }
    deepStrictEqual(enriched.validateWord(enriched.makeWordNormal({ text: 'ah', emphasis: enriched.makeWordEmphasis() })), [])
    deepStrictEqual(enriched.validateWord(enriched.makeWordNormal({ text: 'ah', emphasis: enriched.makeWordEmphasis({ value: false }) })), [])
  })

  it('allows consistent part ids across adjacent lines and compares ids exactly', () => {
    const part = enriched.makePart({ type: enriched.PartType.CHORUS, id: 'Chorus', raw: 'chorus' })
    const parts = [
      part,
      { ...part },
      { ...part, id: 'chorus' },
      { ...part, id: undefined },
      { ...part, id: '' },
      undefined,
      enriched.makePart({ type: enriched.PartType.VERSE, raw: 'Verse 1' }),
      enriched.makePart({ type: enriched.PartType.VERSE, raw: 'Verse 2' }),
    ]
    for (const diagnostics of validatePartsInBothLayers(parts)) {
      deepStrictEqual(diagnostics, [])
    }
  })

  it('reports inconsistent type or raw for the same part id', () => {
    const part = enriched.makePart({ type: enriched.PartType.CHORUS, id: 'Chorus', raw: 'chorus' })
    const parts = [
      part,
      { ...part, type: enriched.PartType.VERSE },
      { ...part, raw: 'Chorus' },
      enriched.makePart({ type: enriched.PartType.CHORUS, id: 'Other' }),
      enriched.makePart({ type: enriched.PartType.CHORUS, id: 'Other', raw: '' }),
    ]
    for (const diagnostics of validatePartsInBothLayers(parts)) {
      deepStrictEqual(diagnostics, [
        { path: 'lines[1].part', code: 'lyric.part.mismatch' },
        { path: 'lines[2].part', code: 'lyric.part.mismatch' },
        { path: 'lines[4].part', code: 'lyric.part.mismatch' },
      ])
    }
  })

  it('reports a part id reused after another section only at the new run', () => {
    const part = enriched.makePart({ type: enriched.PartType.CHORUS, id: 'Chorus', raw: 'chorus' })
    const separators = [{ ...part, id: 'Other' }, undefined, { ...part, id: '' }, { ...part, id: undefined }]
    for (const separator of separators) {
      for (const diagnostics of validatePartsInBothLayers([part, separator, part, part])) {
        deepStrictEqual(diagnostics, [{ path: 'lines[2].part.id', code: 'lyric.part.id.reused' }])
      }
    }
  })

  it('keys roman and ruby annotations by language and scheme', () => {
    for (const model of [document, enriched]) {
      const identities = [
        { language: 'JA-Latn', scheme: 'HEPBURN' },
        { language: 'ja-latn', scheme: 'kunrei' },
        { language: 'ja', scheme: 'hepburn' },
        { language: 'ja-latn', scheme: 'hepburn' },
        { language: 'ja-latn' },
        { language: 'JA-LATN', scheme: '' },
      ]
      const word = model.makeWordAnnotation({
        rubies: identities.map((identity) => model.makeWordAnnotationRuby(identity)),
        romans: identities.map((identity) => model.makeWordAnnotationRoman(identity)),
        translations: ['zh-Hans', 'ZH-HANS'].map((language) => model.makeWordAnnotationTranslation({ language, text: 'translation' })),
      })
      const line = model.makeLineAnnotation({
        romans: identities.map((identity) => model.makeLineAnnotationRoman({ ...identity, text: 'roman' })),
        translations: ['zh-Hans', 'ZH-HANS'].map((language) => model.makeLineAnnotationTranslation({ language, text: 'translation' })),
      })
      deepStrictEqual(model.validateWordAnnotation(word), [
        { path: 'rubies[3]', code: 'line.word.annotation.rubies.duplicate' },
        { path: 'rubies[5]', code: 'line.word.annotation.rubies.duplicate' },
        { path: 'romans[3]', code: 'line.word.annotation.romans.duplicate' },
        { path: 'romans[5]', code: 'line.word.annotation.romans.duplicate' },
        { path: 'translations[1]', code: 'line.word.annotation.translations.language.duplicate' },
      ])
      deepStrictEqual(model.validateLineAnnotation(line), [
        { path: 'romans[3]', code: 'line.annotation.romans.duplicate' },
        { path: 'romans[5]', code: 'line.annotation.romans.duplicate' },
        { path: 'translations[1]', code: 'line.annotation.translations.language.duplicate' },
      ])
    }
  })

  it('validates annotation languages independently of scheme identifiers', () => {
    for (const language of ['ja-latn', 'ja_Latn']) {
      const identity = { language, scheme: 'custom_romanization' }
      const line = enriched.makeLineNormal({
        time: enriched.makeTimeRange({ start: 0, end: 1000 }),
        content: enriched.makeLineContentWords([
          enriched.makeWordNormal({
            text: 'x',
            time: enriched.makeTimeRange({ start: 0, end: 1000 }),
            annotation: enriched.makeWordAnnotation({
              rubies: [enriched.makeWordAnnotationRuby({ ...identity, tokens: [enriched.makeWordAnnotationToken({ text: 'shi' })] })],
              romans: [enriched.makeWordAnnotationRoman({ ...identity, tokens: [enriched.makeWordAnnotationToken({ text: 'shi' })] })],
            }),
          }),
        ]),
        annotation: enriched.makeLineAnnotation({ romans: [enriched.makeLineAnnotationRoman({ ...identity, text: 'shi' })] }),
      })
      const diagnostics = enriched.validateLine(line, '', enriched.Timing.WORD)
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
      enriched.makeLineNormal({
        time: enriched.makeTimeRange({ start: 1000, end: 2000 }),
        languages: ['en'],
        content: enriched.makeLineContentWords([
          enriched.makeWordNormal({ text: 'hi', language: 'en', time: enriched.makeTimeRange({ start: 1000, end: 1500 }) }),
          enriched.makeWordSpace({ text: ' ' }),
          enriched.makeWordNormal({ text: 'there', language: 'en', time: enriched.makeTimeRange({ start: 1500, end: 2000 }) }),
        ]),
      }),
    ]
    const lyric = enriched.makeLyric({
      format: 'lrc',
      timing: enriched.Timing.WORD,
      status: enriched.LyricStatus.VALID,
      languages: enriched.deriveLanguageUsages(lines),
      lines,
    })
    deepStrictEqual(enriched.validateLyric(lyric), [])
  })

  // The codes are a contract the other bindings copy verbatim, so they are asserted as the strings they are.
  it('reports an undeclared timing', () => {
    const lyric = document.makeLyric({
      format: 'lrc',
      lines: [
        document.makeLineNormal({
          time: document.makeTimeRange({ start: 1000 }),
          languages: ['en'],
          content: document.makeLineContentText('hi there'),
        }),
      ],
    })
    deepStrictEqual(document.validateLyric(lyric), [{ path: 'timing', code: 'lyric.timing.unspecified' }])
  })

  it('reports undeclared languages and an unsplit word', () => {
    const lyric = enriched.makeLyric({
      format: 'lrc',
      timing: enriched.Timing.WORD,
      status: enriched.LyricStatus.VALID,
      lines: [
        enriched.makeLineNormal({
          time: enriched.makeTimeRange({ start: 1000, end: 2000 }),
          languages: ['en'],
          content: enriched.makeLineContentWords([
            enriched.makeWordNormal({ text: 'hi there', language: 'en', time: enriched.makeTimeRange({ start: 1000, end: 2000 }) }),
          ]),
        }),
      ],
    })
    deepStrictEqual(enriched.validateLyric(lyric), [
      { path: 'languages', code: 'lyric.languages.mismatch' },
      { path: 'lines[0].content.words[0].text', code: 'word.text.separator' },
    ])
  })

  // An untimed lyric marks out no stretches, so it reports the line itself instead of asking it for a range it may not have.
  it('reports an instrumental line in an untimed lyric', () => {
    const lyric = enriched.makeLyric({
      format: 'lrc',
      timing: enriched.Timing.NONE,
      status: enriched.LyricStatus.VALID,
      lines: [enriched.makeLineInstrumental()],
    })
    deepStrictEqual(enriched.validateLyric(lyric), [{ path: 'lines[0].type', code: 'lyric.timing.none.instrumental' }])
  })

  // A line other than the last ends where the timeline moves on, so one left open would be shown for the rest of the song.
  it('reports a line left open above', () => {
    const lyric = lineTimed(textLine(0, 1000), textLine(1000), textLine(2000, 3000))
    deepStrictEqual(enriched.validateLyric(lyric), [{ path: 'lines[1].time.end', code: 'lyric.line.time.end.missing' }])
  })

  // Nothing in a lyric states where it stops, so the last line is the one line whose end the data cannot carry.
  it('accepts the last line left open above', () => {
    const lyric = lineTimed(textLine(0, 1000), textLine(1000, 2000), textLine(2000))
    deepStrictEqual(enriched.validateLyric(lyric), [])
  })

  // A line carrying no range at all is already reported for that, so it is not asked for an end on top.
  it('reports a line with no range once', () => {
    const lyric = lineTimed(enriched.makeLineNormal({ content: enriched.makeLineContentText('x') }), textLine(1000, 2000))
    deepStrictEqual(enriched.validateLyric(lyric), [{ path: 'lines[0].time', code: 'lyric.timing.line.time_missing' }])
  })

  // The two layers hold the same rule in two implementations, so the document one is checked against the same case.
  it('reports a line left open above in the document layer', () => {
    const lyric = document.makeLyric({
      format: 'lrc',
      timing: document.Timing.LINE,
      lines: [
        document.makeLineNormal({ time: document.makeTimeRange({ start: 0 }), content: document.makeLineContentText('x') }),
        document.makeLineNormal({ time: document.makeTimeRange({ start: 1000, end: 2000 }), content: document.makeLineContentText('y') }),
      ],
    })
    deepStrictEqual(document.validateLyric(lyric), [{ path: 'lines[0].time.end', code: 'lyric.line.time.end.missing' }])
  })

  // Word-level timing still marks out each line, and a line carrying no range leaves its words with nothing to fall inside.
  it('reports a word-level line with no range', () => {
    const lines = [
      enriched.makeLineNormal({
        content: enriched.makeLineContentWords([enriched.makeWordNormal({ text: 'x', time: enriched.makeTimeRange({ start: 1000, end: 2000 }) })]),
      }),
    ]
    const lyric = enriched.makeLyric({ format: 'lrc', timing: enriched.Timing.WORD, status: enriched.LyricStatus.VALID, lines })
    deepStrictEqual(enriched.validateLyric(lyric), [{ path: 'lines[0].time', code: 'lyric.timing.line.time_missing' }])
  })
})
