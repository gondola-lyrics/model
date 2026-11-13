import type { Diagnostic, EnrichedLine, EnrichedLyric, Part, TimeRange } from '@root/index'

import { deepStrictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  AgentType,
  CreditRole,
  EnrichedLyricStatus,
  PartType,
  TimingLevel,
  canonicalizeEnrichedLyric,
  canonicalizeMetaCredit,
  decodeEnrichedLyric,
  deriveEnrichedLanguageUsages,
  encodeEnrichedLyric,
  makeAgent,
  makeDocumentLineAnnotation,
  makeDocumentLineAnnotationRoman,
  makeDocumentLineAnnotationRomanContentText,
  makeDocumentLineAnnotationTranslation,
  makeDocumentLineBackground,
  makeDocumentLineContentText,
  makeDocumentLineContentWords,
  makeDocumentLineInstrumental,
  makeDocumentLineNormal,
  makeDocumentLyric,
  makeDocumentWordAnnotation,
  makeDocumentWordAnnotationRoman,
  makeDocumentWordAnnotationRuby,
  makeDocumentWordAnnotationTranslation,
  makeDocumentWordNormal,
  makeDocumentWordSpace,
  makeEnrichedLanguageUsage,
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
  makeMetaCredit,
  makeMeta,
  makeMetaReference,
  makePart,
  makeText,
  makeTimeRange,
  resolveDiagnosticPath,
  validateDocumentLine,
  validateDocumentLineAnnotation,
  validateDocumentLineAnnotationRoman,
  validateDocumentLineBackground,
  validateDocumentLineContent,
  validateDocumentLyric,
  validateDocumentWord,
  validateDocumentWordAnnotation,
  validateDocumentWords,
  validateEnrichedLine,
  validateEnrichedLineAnnotation,
  validateEnrichedLineAnnotationRoman,
  validateEnrichedLineBackground,
  validateEnrichedLineContent,
  validateEnrichedLyric,
  validateEnrichedWord,
  validateEnrichedWordAnnotation,
  validateEnrichedWords,
  validateAgent,
  validateMeta,
  validateMetaCredit,
  validateMetaReference,
  validateText,
  validateTextToken,
} from '@root/index'

const textLine = (start: number, end?: number): EnrichedLine => {
  return makeEnrichedLineNormal({ time: makeTimeRange({ start, end }), content: makeEnrichedLineContentText('x') })
}

const lineTimed = (...lines: EnrichedLine[]): EnrichedLyric => {
  return makeEnrichedLyric({ format: 'lrc', timing: TimingLevel.LINE, status: EnrichedLyricStatus.VALID, lines })
}

const multilingualLyric = (): EnrichedLyric => {
  return makeEnrichedLyric({
    status: EnrichedLyricStatus.VALID,
    timing: TimingLevel.NONE,
    lines: [
      makeEnrichedLineNormal({ languages: ['EN', 'JA-Latn', 'ZH-Hans'], content: makeEnrichedLineContentText('first') }),
      makeEnrichedLineNormal({ languages: ['en'], content: makeEnrichedLineContentText('second') }),
    ],
    languageUsages: [
      makeEnrichedLanguageUsage({ tag: 'EN', lineCount: 2 }),
      makeEnrichedLanguageUsage({ tag: 'JA-Latn', lineCount: 1 }),
      makeEnrichedLanguageUsage({ tag: 'zh-HANS', lineCount: 1 }),
    ],
  })
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

const validateTimedPartsInBothLayers = (parts: (Part | undefined)[], sungLineIndices: readonly number[]): Diagnostic[][] => {
  const documentLines = parts.map((part, index) => {
    const time = makeTimeRange({ start: index * 1000, end: (index + 1) * 1000 })
    if (sungLineIndices.includes(index)) {
      return makeDocumentLineNormal({ part, time, content: makeDocumentLineContentText('line') })
    }
    return makeDocumentLineInstrumental({ part, time })
  })
  const enrichedLines = parts.map((part, index) => {
    const time = makeTimeRange({ start: index * 1000, end: (index + 1) * 1000 })
    if (sungLineIndices.includes(index)) {
      return makeEnrichedLineNormal({ part, time, content: makeEnrichedLineContentText('line') })
    }
    return makeEnrichedLineInstrumental({ part, time })
  })
  const document = makeDocumentLyric({ timing: TimingLevel.LINE, lines: documentLines })
  const enriched = makeEnrichedLyric({ status: EnrichedLyricStatus.VALID, timing: TimingLevel.LINE, lines: enrichedLines })
  return [validateDocumentLyric(document), validateEnrichedLyric(enriched)]
}

describe('validate', () => {
  it('reports text languages and empty reference ids locally and once under either lyric', () => {
    const text = makeText({ text: 'Song', language: 'en_US' })
    const reference = makeMetaReference({ platform: 'catalog', ids: [''] })
    const agent = makeAgent({ id: 'singer', type: AgentType.PERSON, names: [text] })
    const credit = makeMetaCredit({ role: CreditRole.PERFORMER, names: [text] })
    const meta = makeMeta({ language: 'en_US', titles: [text], references: [reference], credits: [credit] })
    const snapshot = structuredClone({ text, reference, agent, meta })
    deepStrictEqual(validateText(text), [{ path: 'language', code: 'language.tag.malformed' }])
    deepStrictEqual(validateMetaReference(reference), [{ path: 'ids[0]', code: 'lyric.list.entry.empty' }])
    deepStrictEqual(validateAgent(agent), [{ path: 'names[0].language', code: 'language.tag.malformed' }])
    deepStrictEqual(validateMetaCredit(credit), [{ path: 'names[0].language', code: 'language.tag.malformed' }])
    const expected = [{ path: 'agents[0].names[0].language', code: 'language.tag.malformed' }, ...validateMeta(meta, 'meta')]
    deepStrictEqual(validateMeta(meta), [
      { path: 'language', code: 'language.tag.malformed' },
      { path: 'titles[0].language', code: 'language.tag.malformed' },
      { path: 'credits[0].names[0].language', code: 'language.tag.malformed' },
      { path: 'references[0].ids[0]', code: 'lyric.list.entry.empty' },
    ])
    const document = makeDocumentLyric({ timing: TimingLevel.NONE, meta, agents: [agent] })
    const enriched = makeEnrichedLyric({ status: EnrichedLyricStatus.VALID, timing: TimingLevel.NONE, meta, agents: [agent] })
    deepStrictEqual(validateDocumentLyric(document), expected)
    deepStrictEqual(validateEnrichedLyric(enriched), expected)
    deepStrictEqual({ text, reference, agent, meta }, snapshot)
  })

  it('keeps allowed word, background, and annotation diagnostics consistent when nested', () => {
    const time = makeTimeRange({ start: 0, end: 1000 })
    const annotation = makeDocumentWordAnnotation({
      rubies: [makeDocumentWordAnnotationRuby({ language: 'en_US', tokens: [makeTextToken({ text: 'ruby' })] })],
      romans: [makeDocumentWordAnnotationRoman({ language: 'en_US', tokens: [makeTextToken({ text: 'roman' })] })],
      translations: [makeDocumentWordAnnotationTranslation({ language: 'en_US', text: 'translation' })],
    })
    const roman = makeDocumentLineAnnotationRoman({ language: 'en_US', content: makeDocumentLineAnnotationRomanContentText('roman') })
    const lineAnnotation = makeDocumentLineAnnotation({
      romans: [roman],
      translations: [makeDocumentLineAnnotationTranslation({ language: 'en_US', text: 'translation' })],
    })
    const background = makeDocumentLineBackground({
      time,
      languages: ['en_US'],
      content: makeDocumentLineContentText('background'),
      annotation: lineAnnotation,
    })
    const word = makeDocumentWordNormal({ text: 'word', language: 'en_US', time, annotation })
    const line = makeDocumentLineNormal({ time, content: makeDocumentLineContentWords([word]), backgrounds: [background] })
    const enrichedWord = makeEnrichedWordNormal({ text: 'word', language: 'en_US', time, annotation })
    const enrichedBackground = makeEnrichedLineBackground({ ...background, content: makeEnrichedLineContentText('background') })
    const enrichedLine = makeEnrichedLineNormal({ time, content: makeEnrichedLineContentWords([enrichedWord]), backgrounds: [enrichedBackground] })
    const wordExpected = [
      { path: 'language', code: 'language.tag.malformed' },
      { path: 'annotation.rubies[0].language', code: 'language.tag.malformed' },
      { path: 'annotation.romans[0].language', code: 'language.tag.malformed' },
      { path: 'annotation.translations[0].language', code: 'language.tag.malformed' },
    ]
    const backgroundExpected = [
      { path: 'languages[0]', code: 'language.tag.malformed' },
      { path: 'annotation.romans[0].language', code: 'language.tag.malformed' },
      { path: 'annotation.translations[0].language', code: 'language.tag.malformed' },
    ]
    const nestedExpected = [
      ...wordExpected.map((diagnostic) => ({ ...diagnostic, path: `content.words[0].${diagnostic.path}` })),
      ...backgroundExpected.map((diagnostic) => ({ ...diagnostic, path: `backgrounds[0].${diagnostic.path}` })),
    ]
    deepStrictEqual(validateDocumentLineAnnotationRoman(roman), [{ path: 'language', code: 'language.tag.malformed' }])
    deepStrictEqual(validateEnrichedLineAnnotationRoman(roman), [{ path: 'language', code: 'language.tag.malformed' }])
    deepStrictEqual(validateDocumentWord(word, '', TimingLevel.WORD), wordExpected)
    deepStrictEqual(validateEnrichedWord(enrichedWord, '', TimingLevel.WORD), wordExpected)
    deepStrictEqual(validateDocumentLineBackground(background, '', TimingLevel.WORD), backgroundExpected)
    deepStrictEqual(validateEnrichedLineBackground(enrichedBackground, '', TimingLevel.WORD), backgroundExpected)
    deepStrictEqual(validateDocumentLine(line, '', TimingLevel.WORD), nestedExpected)
    deepStrictEqual(validateEnrichedLine(enrichedLine, '', TimingLevel.WORD), nestedExpected)
  })

  it('checks declared timing locally while leaving sibling and parent relationships to their containers', () => {
    const time = makeTimeRange({ start: 0, end: 1000 })
    const word = makeDocumentWordNormal({ text: 'word' })
    const line = makeDocumentLineNormal({ content: makeDocumentLineContentText('line') })
    const background = makeDocumentLineBackground({ content: makeDocumentLineContentText('background') })
    const check = <W, L, B, C>(
      word: W,
      line: L,
      background: B,
      content: C,
      model: {
        word: (word: W, path: string, timing: TimingLevel) => Diagnostic[]
        words: (words: W[], time: TimeRange | undefined, path: string, timing: TimingLevel) => Diagnostic[]
        line: (line: L, path: string, timing: TimingLevel) => Diagnostic[]
        background: (background: B, path: string, timing: TimingLevel) => Diagnostic[]
        content: (content: C, time: TimeRange | undefined, path: string, timing: TimingLevel) => Diagnostic[]
      },
    ): void => {
      for (const timing of [TimingLevel.WORD, TimingLevel.UNSPECIFIED, 99 as TimingLevel]) {
        deepStrictEqual(model.word(word, '', timing), [{ path: '', code: 'line.word.time.missing' }])
        deepStrictEqual(model.words([word], time, '', timing), [{ path: '[0]', code: 'line.word.time.missing' }])
      }
      for (const timing of [TimingLevel.NONE, TimingLevel.LINE]) {
        deepStrictEqual(model.word(word, '', timing), [])
      }
      for (const timing of [TimingLevel.LINE, TimingLevel.WORD]) {
        deepStrictEqual(model.line(line, '', timing), [{ path: 'time', code: 'lyric.timing.line.time_missing' }])
        deepStrictEqual(model.background(background, '', timing), [{ path: 'time', code: 'lyric.timing.line.time_missing' }])
      }
      deepStrictEqual(model.word({ ...word, time }, '', TimingLevel.NONE), [{ path: 'time', code: 'lyric.timing.none.present' }])
      deepStrictEqual(model.line({ ...line, time }, '', TimingLevel.NONE), [{ path: 'time', code: 'lyric.timing.none.present' }])
      deepStrictEqual(model.background({ ...background, time }, '', TimingLevel.NONE), [{ path: 'time', code: 'lyric.timing.none.present' }])
      deepStrictEqual(model.content(content, time, '', TimingLevel.NONE), [{ path: 'words', code: 'lyric.timing.none.words' }])
      deepStrictEqual(model.content(content, time, '', TimingLevel.LINE), [{ path: 'words', code: 'lyric.timing.line.words' }])
      const uncovered = { ...word, time: makeTimeRange({ start: 0, end: 2000 }) }
      deepStrictEqual(model.word(uncovered, '', TimingLevel.WORD), [])
      deepStrictEqual(model.words([uncovered], time, '', TimingLevel.WORD), [{ path: '[0].time', code: 'line.word.time.uncovered' }])
    }
    check(word, line, background, makeDocumentLineContentWords([word]), {
      word: validateDocumentWord,
      words: validateDocumentWords,
      line: validateDocumentLine,
      background: validateDocumentLineBackground,
      content: validateDocumentLineContent,
    })
    const enrichedWord = makeEnrichedWordNormal({ text: 'word' })
    const enrichedLine = makeEnrichedLineNormal({ content: makeEnrichedLineContentText('line') })
    check(
      enrichedWord,
      enrichedLine,
      makeEnrichedLineBackground({ content: makeEnrichedLineContentText('background') }),
      makeEnrichedLineContentWords([enrichedWord]),
      {
        word: validateEnrichedWord,
        words: validateEnrichedWords,
        line: validateEnrichedLine,
        background: validateEnrichedLineBackground,
        content: validateEnrichedLineContent,
      },
    )
    const document = makeDocumentLyric({ timing: TimingLevel.LINE, lines: [line] })
    const enriched = makeEnrichedLyric({ status: EnrichedLyricStatus.VALID, timing: TimingLevel.LINE, lines: [enrichedLine] })
    const expected = [{ path: 'lines[0].time', code: 'lyric.timing.line.time_missing' }]
    deepStrictEqual(validateDocumentLyric(document), expected)
    deepStrictEqual(validateEnrichedLyric(enriched), expected)
  })

  it('reports all-default repeated entries locally without rejecting meaningful empty word tokens', () => {
    const tokens = [makeTextToken(), makeTextToken({ time: makeTimeRange({ start: 0 }) }), makeTextToken({ extra: { source: '' } })]
    const annotation = makeDocumentWordAnnotation({
      rubies: [makeDocumentWordAnnotationRuby()],
      romans: [makeDocumentWordAnnotationRoman({ tokens })],
      translations: [makeDocumentWordAnnotationTranslation()],
    })
    const expected = [
      { path: 'rubies[0]', code: 'lyric.list.entry.empty' },
      { path: 'romans[0].tokens[0]', code: 'lyric.list.entry.empty' },
      { path: 'translations[0]', code: 'lyric.list.entry.empty' },
    ]
    deepStrictEqual(validateTextToken(tokens[0]!), [])
    deepStrictEqual(validateDocumentWordAnnotation(annotation), expected)
    deepStrictEqual(validateEnrichedWordAnnotation(annotation), expected)
    const lineAnnotation = makeDocumentLineAnnotation({ translations: [makeDocumentLineAnnotationTranslation()] })
    deepStrictEqual(validateDocumentLineAnnotation(lineAnnotation), [{ path: 'translations[0]', code: 'lyric.list.entry.empty' }])
    deepStrictEqual(validateEnrichedLineAnnotation(lineAnnotation), [{ path: 'translations[0]', code: 'lyric.list.entry.empty' }])
    const reference = makeMetaReference({ platform: 'catalog', ids: [''] })
    const meta = makeMeta({ unknowns: [{ key: '', value: '' }], isrcs: [''], references: [reference] })
    deepStrictEqual(validateMeta(meta), [
      { path: 'references[0].ids[0]', code: 'lyric.list.entry.empty' },
      { path: 'unknowns[0]', code: 'lyric.list.entry.empty' },
      { path: 'isrcs[0]', code: 'lyric.list.entry.empty' },
    ])
    const time = makeTimeRange({ start: 0 })
    const word = makeDocumentWordNormal({ text: 'word', time, annotation })
    const line = makeDocumentLineNormal({ time, content: makeDocumentLineContentWords([word]), annotation: lineAnnotation })
    const document = makeDocumentLyric({ timing: TimingLevel.WORD, lines: [line] })
    const enrichedWord = makeEnrichedWordNormal({ text: 'word', time, annotation })
    const enriched = makeEnrichedLyric({
      status: EnrichedLyricStatus.VALID,
      timing: TimingLevel.WORD,
      lines: [makeEnrichedLineNormal({ time, content: makeEnrichedLineContentWords([enrichedWord]), annotation: lineAnnotation })],
    })
    const nested = [
      ...expected.map((diagnostic) => ({ ...diagnostic, path: `lines[0].content.words[0].annotation.${diagnostic.path}` })),
      { path: 'lines[0].annotation.translations[0]', code: 'lyric.list.entry.empty' },
    ]
    deepStrictEqual(validateDocumentLyric(document), nested)
    deepStrictEqual(validateEnrichedLyric(enriched), nested)
  })

  it('resolves content and array diagnostics relative to the actual input', () => {
    const content = makeDocumentLineContentText('')
    const word = makeDocumentWordNormal({ text: 'word', time: makeTimeRange({ start: -1 }) })
    const check = <C, W>(
      content: C,
      word: W,
      model: {
        content: (content: C | undefined, time: TimeRange | undefined, path?: string) => Diagnostic[]
        words: (words: W[], time: TimeRange | undefined, path?: string) => Diagnostic[]
      },
    ): void => {
      const diagnostic = model.content(content, undefined)[0]!
      deepStrictEqual(diagnostic, { path: 'text', code: 'line.content.text.empty' })
      deepStrictEqual(resolveDiagnosticPath(content, diagnostic.path), '')
      const nested = model.content(content, undefined, 'lines[0].content')[0]!
      deepStrictEqual(nested.path, 'lines[0].content.text')
      deepStrictEqual(resolveDiagnosticPath({ lines: [{ content }] }, nested.path), '')
      deepStrictEqual(model.content(undefined, undefined), [{ path: '', code: 'line.content.missing' }])
      deepStrictEqual(model.words([word], undefined), [{ path: '[0].time', code: 'time.range.start.invalid' }])
      deepStrictEqual(model.words([word], undefined, 'lines[0].content.words'), [
        { path: 'lines[0].content.words[0].time', code: 'time.range.start.invalid' },
      ])
    }
    check(content, word, { content: validateDocumentLineContent, words: validateDocumentWords })
    check(makeEnrichedLineContentText(''), makeEnrichedWordNormal({ text: 'word', time: word.time }), {
      content: validateEnrichedLineContent,
      words: validateEnrichedWords,
    })
    deepStrictEqual(resolveDiagnosticPath([word], '[0]'), word)
    deepStrictEqual(resolveDiagnosticPath([word], '[0].time.start'), -1)
    deepStrictEqual(resolveDiagnosticPath([word], ''), [word])
    deepStrictEqual(resolveDiagnosticPath([word], '[1]'), undefined)
    deepStrictEqual(resolveDiagnosticPath([{ missing: undefined }], '[0].missing'), undefined)
    for (const path of ['[-1]', '[0.5]', '[0].', '[0][0]', '[0].time.[0]', '[0].time()', '[0];text', '[0]\n', '[0].time\n']) {
      deepStrictEqual(resolveDiagnosticPath([word], path), undefined, path)
    }
  })

  it('stops local checks at forbidden fields while retaining global line identities', () => {
    const time = makeTimeRange({ start: 0, end: 1000 })
    const space = {
      ...makeDocumentWordSpace({ text: ' ' }),
      language: 'en_US',
      annotation: makeDocumentWordAnnotation({ romans: [makeDocumentWordAnnotationRoman({ language: 'en_US' })] }),
    }
    const line = makeDocumentLineNormal({ time, content: makeDocumentLineContentWords([space]) })
    const enrichedSpace = { ...makeEnrichedWordSpace({ text: ' ' }), language: 'en_US', annotation: space.annotation }
    const enrichedLine = makeEnrichedLineNormal({ time, content: makeEnrichedLineContentWords([enrichedSpace]) })
    const expected = [
      { path: 'language', code: 'line.word.language.unexpected' },
      { path: 'annotation', code: 'line.word.annotation.unexpected' },
    ]
    deepStrictEqual(validateDocumentWord(space, '', TimingLevel.WORD), expected)
    deepStrictEqual(validateEnrichedWord(enrichedSpace, '', TimingLevel.WORD), expected)
    const nested = expected.map((diagnostic) => ({ ...diagnostic, path: `content.words[0].${diagnostic.path}` }))
    deepStrictEqual(validateDocumentLine(line, '', TimingLevel.WORD), nested)
    deepStrictEqual(validateEnrichedLine(enrichedLine, '', TimingLevel.WORD), nested)
    const instrumental = {
      ...makeDocumentLineInstrumental({ id: 'duplicate', time }),
      backgrounds: [makeDocumentLineBackground({ id: 'duplicate', time, languages: ['en_US'], content: makeDocumentLineContentWords([space]) })],
    }
    const enrichedInstrumental = {
      ...makeEnrichedLineInstrumental({ id: 'duplicate', time }),
      backgrounds: [
        makeEnrichedLineBackground({ id: 'duplicate', time, languages: ['en_US'], content: makeEnrichedLineContentWords([enrichedSpace]) }),
      ],
    }
    deepStrictEqual(validateDocumentLine(instrumental, '', TimingLevel.WORD), [{ path: 'backgrounds', code: 'line.backgrounds.unexpected' }])
    deepStrictEqual(validateEnrichedLine(enrichedInstrumental, '', TimingLevel.WORD), [{ path: 'backgrounds', code: 'line.backgrounds.unexpected' }])
    const global = [
      { path: 'lines[0].backgrounds[0]', code: 'lyric.line.id.duplicate' },
      { path: 'lines[0].backgrounds', code: 'line.backgrounds.unexpected' },
    ]
    deepStrictEqual(validateDocumentLyric(makeDocumentLyric({ timing: TimingLevel.WORD, lines: [instrumental] })), global)
    deepStrictEqual(
      validateEnrichedLyric(makeEnrichedLyric({ status: EnrichedLyricStatus.VALID, timing: TimingLevel.WORD, lines: [enrichedInstrumental] })),
      global,
    )
  })

  it('accepts new credit roles with optional source labels and preserves their meaning', () => {
    for (const role of [CreditRole.SONGWRITER, CreditRole.RECORDING_ENGINEER]) {
      for (const raw of [undefined, 'Source Role']) {
        const credit = makeMetaCredit({ role, raw, names: [makeText({ text: 'Contributor' })] })
        deepStrictEqual(validateMetaCredit(credit), [])
        const canonical = canonicalizeMetaCredit(credit)
        deepStrictEqual({ role: canonical.role, raw: canonical.raw }, { role, raw })
      }
    }
  })

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
        deepStrictEqual(validateEnrichedWord(word, '', TimingLevel.LINE), [])
      }
    }
    deepStrictEqual(validateEnrichedWord(makeEnrichedWordNormal({ text: 'ah', emphasis: makeEnrichedWordEmphasis() }), '', TimingLevel.LINE), [])
    deepStrictEqual(
      validateEnrichedWord(makeEnrichedWordNormal({ text: 'ah', emphasis: makeEnrichedWordEmphasis({ value: false }) }), '', TimingLevel.LINE),
      [],
    )
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

  it('allows interludes before and between sung sections while preserving instrumental endings', () => {
    const interlude = makePart({ type: PartType.INTERLUDE, id: 'opening', raw: 'interlude' })
    const verse = makePart({ type: PartType.VERSE })
    const chorus = makePart({ type: PartType.CHORUS })
    const parts = [
      interlude,
      { ...interlude },
      verse,
      { ...interlude, id: 'middle' },
      chorus,
      makePart({ type: PartType.OUTRO }),
      makePart({ type: PartType.INSTRUMENTAL }),
    ]
    for (const diagnostics of validateTimedPartsInBothLayers(parts, [2, 4])) {
      deepStrictEqual(diagnostics, [])
    }
  })

  it('rejects every trailing interlude even when later unsung sections remain', () => {
    const interlude = makePart({ type: PartType.INTERLUDE, raw: 'interlude' })
    const verse = makePart({ type: PartType.VERSE })
    const cases = [
      { parts: [verse, interlude], sung: [0], trailing: [1] },
      { parts: [verse, interlude, { ...interlude }], sung: [0], trailing: [1, 2] },
      { parts: [verse, { ...interlude, id: 'tail' }, { ...interlude, id: 'tail' }], sung: [0], trailing: [1, 2] },
      { parts: [verse, interlude, makePart({ type: PartType.OUTRO })], sung: [0], trailing: [1] },
      { parts: [verse, interlude, makePart({ type: PartType.INSTRUMENTAL })], sung: [0], trailing: [1] },
      { parts: [interlude], sung: [], trailing: [0] },
    ]
    for (const scenario of cases) {
      const expected = scenario.trailing.map((index) => ({ path: `lines[${index}].part.type`, code: 'lyric.part.interlude.trailing' }))
      for (const diagnostics of validateTimedPartsInBothLayers(scenario.parts, scenario.sung)) {
        deepStrictEqual(diagnostics, expected)
      }
    }
  })

  it('requires interlude sections to be carried by instrumental lines', () => {
    const part = makePart({ type: PartType.INTERLUDE })
    const time = makeTimeRange({ start: 0, end: 1000 })
    const documentLine = makeDocumentLineNormal({ part, time, content: makeDocumentLineContentText('line') })
    const enrichedLine = makeEnrichedLineNormal({ part, time, content: makeEnrichedLineContentText('line') })
    const expected = [{ path: 'line.part.type', code: 'line.part.interlude.not_instrumental' }]
    deepStrictEqual(validateDocumentLine(documentLine, 'line', TimingLevel.LINE), expected)
    deepStrictEqual(validateEnrichedLine(enrichedLine, 'line', TimingLevel.LINE), expected)
    deepStrictEqual(validateDocumentLine(makeDocumentLineInstrumental({ part, time }), 'line', TimingLevel.LINE), [])
    deepStrictEqual(validateEnrichedLine(makeEnrichedLineInstrumental({ part, time }), 'line', TimingLevel.LINE), [])
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

  it('reports unresolved status values after decoding', () => {
    const lyric = makeEnrichedLyric({ status: EnrichedLyricStatus.VALID, timing: TimingLevel.NONE })
    for (const status of [EnrichedLyricStatus.UNSPECIFIED, 99 as EnrichedLyricStatus, -1 as EnrichedLyricStatus]) {
      const decoded = decodeEnrichedLyric(encodeEnrichedLyric({ ...lyric, status }))
      deepStrictEqual(decoded.status, status)
      deepStrictEqual(validateEnrichedLyric(decoded), [{ path: 'status', code: 'lyric.status.unspecified' }])
      deepStrictEqual(validateEnrichedLyric({ ...decoded, lines: [makeEnrichedLineNormal()] }), [
        { path: 'status', code: 'lyric.status.unspecified' },
        { path: 'lines[0].content', code: 'line.content.missing' },
      ])
    }
  })

  it('accepts resolved statuses without relaxing content validation', () => {
    for (const status of [EnrichedLyricStatus.VALID, EnrichedLyricStatus.INVALID] as const) {
      const lyric = decodeEnrichedLyric(encodeEnrichedLyric(makeEnrichedLyric({ status, timing: TimingLevel.NONE })))
      deepStrictEqual(lyric.status, status)
      deepStrictEqual(validateEnrichedLyric(lyric), [])
      deepStrictEqual(validateEnrichedLyric({ ...lyric, lines: [makeEnrichedLineNormal()] }), [
        { path: 'lines[0].content', code: 'line.content.missing' },
      ])
    }
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

  it('compares language usages without case and preserves the input', () => {
    const lyric = multilingualLyric()
    const original = structuredClone(lyric)
    deepStrictEqual(validateEnrichedLyric(lyric), [])
    deepStrictEqual(lyric, original)
  })

  it('keeps language usage count, order, and tag errors visible', () => {
    const lyric = multilingualLyric()
    const english = lyric.languageUsages[0]!
    const japanese = lyric.languageUsages[1]!
    const chinese = lyric.languageUsages[2]!
    const mismatch = { path: 'languageUsages', code: 'lyric.language_usages.mismatch' }
    for (const languageUsages of [
      [{ ...english, lineCount: 3 }, japanese, chinese],
      [japanese, english, chinese],
      [english, chinese, japanese],
      [english, japanese],
      [english, japanese, chinese, makeEnrichedLanguageUsage({ tag: 'fr', lineCount: 1 })],
      [{ ...english, tag: 'en-US' }, japanese, chinese],
    ]) {
      const input = { ...lyric, languageUsages }
      const original = structuredClone(input)
      deepStrictEqual(validateEnrichedLyric(input), [mismatch])
      deepStrictEqual(input, original)
    }
    deepStrictEqual(validateEnrichedLyric({ ...lyric, languageUsages: [english, japanese, chinese, { ...english, tag: 'en' }] }), [
      { path: 'languageUsages[3]', code: 'lyric.language_usages.tag.duplicate' },
      mismatch,
    ])
    for (const [tag, code] of [
      ['', 'language.usage.tag.empty'],
      ['en_US', 'language.tag.malformed'],
    ] as const) {
      deepStrictEqual(validateEnrichedLyric({ ...lyric, languageUsages: [{ ...english, tag }, japanese, chinese] }), [
        { path: 'languageUsages[0].tag', code },
        mismatch,
      ])
    }
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
