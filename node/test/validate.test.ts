import type { Diagnostic, EnrichedLine, EnrichedLyric, Part } from '@root/index'

import { deepStrictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  AgentType,
  EnrichedLyricStatus,
  PartType,
  TimingLevel,
  canonicalizeEnrichedLyric,
  deriveEnrichedLanguageUsages,
  makeAgent,
  makeDocumentLineAnnotation,
  makeDocumentLineAnnotationRoman,
  makeDocumentLineAnnotationRomanContentText,
  makeDocumentLineAnnotationTranslation,
  makeDocumentLineBackground,
  makeDocumentLineContentText,
  makeDocumentLineInstrumental,
  makeDocumentLineNormal,
  makeDocumentLyric,
  makeDocumentWordAnnotation,
  makeDocumentWordAnnotationRoman,
  makeDocumentWordAnnotationRuby,
  makeDocumentWordAnnotationTranslation,
  makeEnrichedLineAnnotation,
  makeEnrichedLineAnnotationRoman,
  makeEnrichedLineAnnotationRomanContentText,
  makeEnrichedLineAnnotationTranslation,
  makeEnrichedLineBackground,
  makeEnrichedLineContentText,
  makeEnrichedLineContentWords,
  makeEnrichedLineInstrumental,
  makeEnrichedLineNormal,
  makeEnrichedLyric,
  makeEnrichedWordAnnotation,
  makeEnrichedWordAnnotationRoman,
  makeEnrichedWordAnnotationRuby,
  makeTextToken,
  makeEnrichedWordAnnotationTranslation,
  makeEnrichedWordEmphasis,
  makeEnrichedWordNormal,
  makeEnrichedWordSpace,
  makePart,
  makeTimeRange,
  resolveDiagnosticPath,
  validateDocumentLine,
  validateDocumentLineAnnotation,
  validateDocumentLyric,
  validateDocumentWordAnnotation,
  validateEnrichedLine,
  validateEnrichedLineAnnotation,
  validateEnrichedLyric,
  validateEnrichedWord,
  validateEnrichedWordAnnotation,
} from '@root/index'

const textLine = (start: number, end?: number): EnrichedLine => {
  return makeEnrichedLineNormal({ time: makeTimeRange({ start, end }), content: makeEnrichedLineContentText('x') })
}

const lineTimed = (...lines: EnrichedLine[]): EnrichedLyric => {
  return makeEnrichedLyric({ format: 'lrc', timing: TimingLevel.LINE, status: EnrichedLyricStatus.VALID, lines })
}

const validatePartsInBothLayers = (parts: (Part | undefined)[]): Diagnostic[][] => {
  const played = makeEnrichedLyric({
    timing: TimingLevel.NONE,
    status: EnrichedLyricStatus.VALID,
    lines: parts.map((part) => makeEnrichedLineNormal({ part, content: makeEnrichedLineContentText('line') })),
  })
  const stored = makeDocumentLyric({
    timing: TimingLevel.NONE,
    lines: parts.map((part) => makeDocumentLineNormal({ part, content: makeDocumentLineContentText('line') })),
  })
  return [validateEnrichedLyric(played), validateDocumentLyric(stored)]
}

describe('validate', () => {
  it('locates agent reference diagnostics through renamed fields in both layers', () => {
    const time = makeTimeRange({ start: 1000, end: 2000 })
    const agents = [makeAgent({ id: 'known', type: AgentType.PERSON })]
    const agentIds = ['known', 'missing']
    const document = makeDocumentLyric({
      timing: TimingLevel.LINE,
      agents,
      lines: [
        makeDocumentLineNormal({
          time,
          agentIds,
          content: makeDocumentLineContentText('line'),
          backgrounds: [makeDocumentLineBackground({ time, agentIds: ['background-missing'], content: makeDocumentLineContentText('background') })],
        }),
      ],
    })
    const enriched = makeEnrichedLyric({
      status: EnrichedLyricStatus.VALID,
      timing: TimingLevel.LINE,
      agents,
      lines: [
        makeEnrichedLineNormal({
          time,
          agentIds,
          content: makeEnrichedLineContentText('line'),
          backgrounds: [makeEnrichedLineBackground({ time, agentIds: ['background-missing'], content: makeEnrichedLineContentText('background') })],
        }),
      ],
    })
    for (const model of [
      { lyric: document, diagnostics: validateDocumentLyric(document) },
      { lyric: enriched, diagnostics: validateEnrichedLyric(enriched) },
    ]) {
      deepStrictEqual(model.diagnostics, [
        { path: 'lines[0].agentIds[1]', code: 'lyric.line.agent.dangling' },
        { path: 'lines[0].backgrounds[0].agentIds[0]', code: 'lyric.line.agent.dangling' },
      ])
      deepStrictEqual(
        model.diagnostics.map((diagnostic) => resolveDiagnosticPath(model.lyric, diagnostic.path)),
        ['missing', 'background-missing'],
      )
    }
    const documentInstrumental = { ...makeDocumentLineInstrumental({ time }), agentIds: ['missing'] }
    const enrichedInstrumental = { ...makeEnrichedLineInstrumental({ time }), agentIds: ['missing'] }
    for (const model of [
      { line: documentInstrumental, diagnostics: validateDocumentLine(documentInstrumental, 'line', TimingLevel.LINE) },
      { line: enrichedInstrumental, diagnostics: validateEnrichedLine(enrichedInstrumental, 'line', TimingLevel.LINE) },
    ]) {
      deepStrictEqual(model.diagnostics, [{ path: 'line.agentIds', code: 'line.agent_ids.unexpected' }])
      deepStrictEqual(resolveDiagnosticPath({ line: model.line }, model.diagnostics[0]!.path), ['missing'])
    }
  })

  it('requires an emphasis decision when its origin is set', () => {
    for (const derived of [false, true]) {
      const line = makeEnrichedLineNormal({
        time: makeTimeRange({ start: 1000, end: 5000 }),
        content: makeEnrichedLineContentWords([
          makeEnrichedWordNormal({
            text: 'ah',
            time: makeTimeRange({ start: 1000, end: 5000 }),
            emphasis: makeEnrichedWordEmphasis({ derived }),
          }),
        ]),
      })
      const lyric = canonicalizeEnrichedLyric(makeEnrichedLyric({ timing: TimingLevel.WORD, status: EnrichedLyricStatus.VALID, lines: [line] }))
      deepStrictEqual(validateEnrichedLyric(lyric), [{ path: 'lines[0].content.words[0].emphasis.value', code: 'line.word.emphasis.value.missing' }])
      for (const value of [false, true]) {
        const word = makeEnrichedWordNormal({ text: 'ah', emphasis: makeEnrichedWordEmphasis({ value, derived }) })
        deepStrictEqual(validateEnrichedWord(word), [])
      }
    }
    deepStrictEqual(validateEnrichedWord(makeEnrichedWordNormal({ text: 'ah', emphasis: makeEnrichedWordEmphasis() })), [])
    deepStrictEqual(validateEnrichedWord(makeEnrichedWordNormal({ text: 'ah', emphasis: makeEnrichedWordEmphasis({ value: false }) })), [])
  })

  it('allows consistent part ids across adjacent lines and compares ids exactly', () => {
    const part = makePart({ type: PartType.CHORUS, id: 'Chorus', raw: 'chorus' })
    const parts = [
      part,
      { ...part },
      { ...part, id: 'chorus' },
      { ...part, id: undefined },
      { ...part, id: '' },
      undefined,
      makePart({ type: PartType.VERSE, raw: 'Verse 1' }),
      makePart({ type: PartType.VERSE, raw: 'Verse 2' }),
    ]
    for (const diagnostics of validatePartsInBothLayers(parts)) {
      deepStrictEqual(diagnostics, [])
    }
  })

  it('reports inconsistent type or raw for the same part id', () => {
    const part = makePart({ type: PartType.CHORUS, id: 'Chorus', raw: 'chorus' })
    const parts = [
      part,
      { ...part, type: PartType.VERSE },
      { ...part, raw: 'Chorus' },
      makePart({ type: PartType.CHORUS, id: 'Other' }),
      makePart({ type: PartType.CHORUS, id: 'Other', raw: '' }),
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
    const part = makePart({ type: PartType.CHORUS, id: 'Chorus', raw: 'chorus' })
    const separators = [{ ...part, id: 'Other' }, undefined, { ...part, id: '' }, { ...part, id: undefined }]
    for (const separator of separators) {
      for (const diagnostics of validatePartsInBothLayers([part, separator, part, part])) {
        deepStrictEqual(diagnostics, [{ path: 'lines[2].part.id', code: 'lyric.part.id.reused' }])
      }
    }
  })

  it('keys roman and ruby annotations by language and scheme', () => {
    for (const model of [
      {
        makeWordAnnotation: makeDocumentWordAnnotation,
        makeWordAnnotationRuby: makeDocumentWordAnnotationRuby,
        makeWordAnnotationRoman: makeDocumentWordAnnotationRoman,
        makeWordAnnotationTranslation: makeDocumentWordAnnotationTranslation,
        makeLineAnnotation: makeDocumentLineAnnotation,
        makeLineAnnotationRoman: makeDocumentLineAnnotationRoman,
        makeLineAnnotationRomanContentText: makeDocumentLineAnnotationRomanContentText,
        makeLineAnnotationTranslation: makeDocumentLineAnnotationTranslation,
        validateWordAnnotation: validateDocumentWordAnnotation,
        validateLineAnnotation: validateDocumentLineAnnotation,
      },
      {
        makeWordAnnotation: makeEnrichedWordAnnotation,
        makeWordAnnotationRuby: makeEnrichedWordAnnotationRuby,
        makeWordAnnotationRoman: makeEnrichedWordAnnotationRoman,
        makeWordAnnotationTranslation: makeEnrichedWordAnnotationTranslation,
        makeLineAnnotation: makeEnrichedLineAnnotation,
        makeLineAnnotationRoman: makeEnrichedLineAnnotationRoman,
        makeLineAnnotationRomanContentText: makeEnrichedLineAnnotationRomanContentText,
        makeLineAnnotationTranslation: makeEnrichedLineAnnotationTranslation,
        validateWordAnnotation: validateEnrichedWordAnnotation,
        validateLineAnnotation: validateEnrichedLineAnnotation,
      },
    ]) {
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
        romans: identities.map((identity) =>
          model.makeLineAnnotationRoman({ ...identity, content: model.makeLineAnnotationRomanContentText('roman') }),
        ),
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
      const line = makeEnrichedLineNormal({
        time: makeTimeRange({ start: 0, end: 1000 }),
        content: makeEnrichedLineContentWords([
          makeEnrichedWordNormal({
            text: 'x',
            time: makeTimeRange({ start: 0, end: 1000 }),
            annotation: makeEnrichedWordAnnotation({
              rubies: [makeEnrichedWordAnnotationRuby({ ...identity, tokens: [makeTextToken({ text: 'shi' })] })],
              romans: [makeEnrichedWordAnnotationRoman({ ...identity, tokens: [makeTextToken({ text: 'shi' })] })],
            }),
          }),
        ]),
        annotation: makeEnrichedLineAnnotation({
          romans: [
            makeEnrichedLineAnnotationRoman({
              language,
              scheme: 'independent_romanization',
              content: makeEnrichedLineAnnotationRomanContentText('shi'),
            }),
          ],
        }),
      })
      const diagnostics = validateEnrichedLine(line, '', TimingLevel.WORD)
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
      makeEnrichedLineNormal({
        time: makeTimeRange({ start: 1000, end: 2000 }),
        languages: ['en'],
        content: makeEnrichedLineContentWords([
          makeEnrichedWordNormal({ text: 'hi', language: 'en', time: makeTimeRange({ start: 1000, end: 1500 }) }),
          makeEnrichedWordSpace({ text: ' ' }),
          makeEnrichedWordNormal({ text: 'there', language: 'en', time: makeTimeRange({ start: 1500, end: 2000 }) }),
        ]),
      }),
    ]
    const lyric = makeEnrichedLyric({
      format: 'lrc',
      timing: TimingLevel.WORD,
      status: EnrichedLyricStatus.VALID,
      languageUsages: deriveEnrichedLanguageUsages(lines),
      lines,
    })
    deepStrictEqual(validateEnrichedLyric(lyric), [])
  })

  // The codes are a contract the other bindings copy verbatim, so they are asserted as the strings they are.
  it('reports an undeclared timing', () => {
    const lyric = makeDocumentLyric({
      format: 'lrc',
      lines: [
        makeDocumentLineNormal({
          time: makeTimeRange({ start: 1000 }),
          languages: ['en'],
          content: makeDocumentLineContentText('hi there'),
        }),
      ],
    })
    deepStrictEqual(validateDocumentLyric(lyric), [{ path: 'timing', code: 'lyric.timing.unspecified' }])
  })

  it('reports missing language usages and an unsplit word', () => {
    const lyric = makeEnrichedLyric({
      format: 'lrc',
      timing: TimingLevel.WORD,
      status: EnrichedLyricStatus.VALID,
      lines: [
        makeEnrichedLineNormal({
          time: makeTimeRange({ start: 1000, end: 2000 }),
          languages: ['en'],
          content: makeEnrichedLineContentWords([
            makeEnrichedWordNormal({ text: 'hi there', language: 'en', time: makeTimeRange({ start: 1000, end: 2000 }) }),
          ]),
        }),
      ],
    })
    deepStrictEqual(validateEnrichedLyric(lyric), [
      { path: 'languageUsages', code: 'lyric.language_usages.mismatch' },
      { path: 'lines[0].content.words[0].text', code: 'word.text.separator' },
    ])
  })

  // An untimed lyric marks out no stretches, so it reports the line itself instead of asking it for a range it may not have.
  it('reports an instrumental line in an untimed lyric', () => {
    const lyric = makeEnrichedLyric({
      format: 'lrc',
      timing: TimingLevel.NONE,
      status: EnrichedLyricStatus.VALID,
      lines: [makeEnrichedLineInstrumental()],
    })
    deepStrictEqual(validateEnrichedLyric(lyric), [{ path: 'lines[0].type', code: 'lyric.timing.none.instrumental' }])
  })

  // A line other than the last ends where the timeline moves on, so one left open would be shown for the rest of the song.
  it('reports a line left open above', () => {
    const lyric = lineTimed(textLine(0, 1000), textLine(1000), textLine(2000, 3000))
    deepStrictEqual(validateEnrichedLyric(lyric), [{ path: 'lines[1].time.end', code: 'lyric.line.time.end.missing' }])
  })

  // Nothing in a lyric states where it stops, so the last line is the one line whose end the data cannot carry.
  it('accepts the last line left open above', () => {
    const lyric = lineTimed(textLine(0, 1000), textLine(1000, 2000), textLine(2000))
    deepStrictEqual(validateEnrichedLyric(lyric), [])
  })

  // A line carrying no range at all is already reported for that, so it is not asked for an end on top.
  it('reports a line with no range once', () => {
    const lyric = lineTimed(makeEnrichedLineNormal({ content: makeEnrichedLineContentText('x') }), textLine(1000, 2000))
    deepStrictEqual(validateEnrichedLyric(lyric), [{ path: 'lines[0].time', code: 'lyric.timing.line.time_missing' }])
  })

  // The two layers hold the same rule in two implementations, so the document one is checked against the same case.
  it('reports a line left open above in the document layer', () => {
    const lyric = makeDocumentLyric({
      format: 'lrc',
      timing: TimingLevel.LINE,
      lines: [
        makeDocumentLineNormal({ time: makeTimeRange({ start: 0 }), content: makeDocumentLineContentText('x') }),
        makeDocumentLineNormal({ time: makeTimeRange({ start: 1000, end: 2000 }), content: makeDocumentLineContentText('y') }),
      ],
    })
    deepStrictEqual(validateDocumentLyric(lyric), [{ path: 'lines[0].time.end', code: 'lyric.line.time.end.missing' }])
  })

  // Word-level timing still marks out each line, and a line carrying no range leaves its words with nothing to fall inside.
  it('reports a word-level line with no range', () => {
    const lines = [
      makeEnrichedLineNormal({
        content: makeEnrichedLineContentWords([makeEnrichedWordNormal({ text: 'x', time: makeTimeRange({ start: 1000, end: 2000 }) })]),
      }),
    ]
    const lyric = makeEnrichedLyric({ format: 'lrc', timing: TimingLevel.WORD, status: EnrichedLyricStatus.VALID, lines })
    deepStrictEqual(validateEnrichedLyric(lyric), [{ path: 'lines[0].time', code: 'lyric.timing.line.time_missing' }])
  })
})
