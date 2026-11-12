import { deepStrictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  Timing,
  canonicalizeDocumentLineAnnotationRoman,
  canonicalizeEnrichedLineAnnotationRoman,
  getDocumentLineAnnotationRomanText,
  getEnrichedLineAnnotationRomanText,
  makeDocumentLineAnnotation,
  makeDocumentLineAnnotationRoman,
  makeDocumentLineAnnotationRomanContentText,
  makeDocumentLineAnnotationRomanContentTokens,
  makeDocumentLineAnnotationRomanToken,
  makeDocumentLineBackground,
  makeDocumentLineContentText,
  makeDocumentLineContentWords,
  makeDocumentLineNormal,
  makeDocumentLyric,
  makeDocumentWordAnnotation,
  makeDocumentWordAnnotationRoman,
  makeDocumentWordAnnotationToken,
  makeDocumentWordNormal,
  makeDocumentWordSpace,
  makeEnrichedLineAnnotation,
  makeEnrichedLineAnnotationRoman,
  makeEnrichedLineAnnotationRomanContentText,
  makeEnrichedLineAnnotationRomanContentTokens,
  makeEnrichedLineAnnotationRomanToken,
  makeEnrichedLineBackground,
  makeEnrichedLineContentText,
  makeEnrichedLineContentWords,
  makeEnrichedLineNormal,
  makeEnrichedWordAnnotation,
  makeEnrichedWordAnnotationRoman,
  makeEnrichedWordAnnotationToken,
  makeEnrichedWordNormal,
  makeEnrichedWordSpace,
  makeTimeRange,
  resolveDocumentLineAnnotationRomanTime,
  resolveDocumentLineAnnotationRomanTokenTime,
  resolveEnrichedLineAnnotationRomanTime,
  resolveEnrichedLineAnnotationRomanTokenTime,
  validateDocumentLine,
  validateDocumentLineAnnotationRoman,
  validateDocumentLyric,
  validateEnrichedLine,
  validateEnrichedLineAnnotationRoman,
} from '@root/index'

const models = [
  {
    makeRoman: makeDocumentLineAnnotationRoman,
    makeText: makeDocumentLineAnnotationRomanContentText,
    makeTokens: makeDocumentLineAnnotationRomanContentTokens,
    makeToken: makeDocumentLineAnnotationRomanToken,
    canonicalize: canonicalizeDocumentLineAnnotationRoman,
    text: getDocumentLineAnnotationRomanText,
    time: resolveDocumentLineAnnotationRomanTime,
    tokenTime: resolveDocumentLineAnnotationRomanTokenTime,
    validateRoman: validateDocumentLineAnnotationRoman,
  },
  {
    makeRoman: makeEnrichedLineAnnotationRoman,
    makeText: makeEnrichedLineAnnotationRomanContentText,
    makeTokens: makeEnrichedLineAnnotationRomanContentTokens,
    makeToken: makeEnrichedLineAnnotationRomanToken,
    canonicalize: canonicalizeEnrichedLineAnnotationRoman,
    text: getEnrichedLineAnnotationRomanText,
    time: resolveEnrichedLineAnnotationRomanTime,
    tokenTime: resolveEnrichedLineAnnotationRomanTokenTime,
    validateRoman: validateEnrichedLineAnnotationRoman,
  },
]

describe('line roman content', () => {
  it('requires exactly one non-empty form and at least one explicit token time', () => {
    for (const model of models) {
      const timed = model.makeToken({ text: 'ni', time: makeTimeRange({ start: 0 }) })
      const examples = [
        {
          roman: model.makeRoman(),
          expected: [['content', 'line.annotation.roman.content.missing']],
        },
        {
          roman: model.makeRoman({ content: model.makeTokens([]) }),
          expected: [['content', 'line.annotation.roman.content.missing']],
        },
        {
          roman: model.makeRoman({ content: model.makeText('') }),
          expected: [['content.text', 'line.annotation.roman.content.text.empty']],
        },
        {
          roman: model.makeRoman({ content: { ...model.makeTokens([timed]), text: '' } }),
          expected: [
            ['content', 'line.annotation.roman.content.ambiguous'],
            ['content.text', 'line.annotation.roman.content.text.empty'],
          ],
        },
        {
          roman: model.makeRoman({ content: model.makeTokens([model.makeToken({ text: 'ni' })]) }),
          expected: [['content.tokens', 'line.annotation.roman.content.tokens.time.missing']],
        },
        {
          roman: model.makeRoman({ content: model.makeTokens([model.makeToken({ text: '', time: timed.time })]) }),
          expected: [['content.tokens[0].text', 'line.annotation.roman.token.text.empty']],
        },
      ]
      for (const { roman, expected } of examples) {
        deepStrictEqual(
          model.validateRoman(roman).map((diagnostic) => [diagnostic.path, diagnostic.code]),
          expected,
        )
      }
      deepStrictEqual(model.validateRoman(model.makeRoman({ content: model.makeText('ni hao') })), [])
      deepStrictEqual(model.validateRoman(model.makeRoman({ content: model.makeTokens([timed, model.makeToken({ text: ' ' })]) })), [])
    }
  })

  it('preserves source text and resolves whole time messages without filling unknown ends', () => {
    for (const model of models) {
      const line = { time: makeTimeRange({ start: 1000, end: 3000 }) }
      const romanTime = makeTimeRange({ start: 900, end: 3500 })
      const tokens = [
        model.makeToken({ time: makeTimeRange({ start: 900, end: 1800 }), text: 'ni' }),
        model.makeToken({ text: '  ' }),
        model.makeToken({ time: makeTimeRange({ start: 2300 }), text: 'hao' }),
      ]
      const roman = model.makeRoman({ content: model.makeTokens(tokens) })
      deepStrictEqual(model.text(roman), 'ni  hao')
      deepStrictEqual(model.text(model.makeRoman({ content: model.makeText('ni  hao') })), 'ni  hao')
      deepStrictEqual(model.time(roman, line), line.time)
      deepStrictEqual(model.time({ ...roman, time: romanTime }, line), romanTime)
      deepStrictEqual(model.tokenTime(tokens[1]!, roman, line), line.time)
      deepStrictEqual(model.tokenTime(tokens[1]!, { ...roman, time: romanTime }, line), romanTime)
      deepStrictEqual(model.tokenTime(tokens[2]!, { ...roman, time: romanTime }, line), { start: 2300 })
      deepStrictEqual(model.validateRoman(roman), [])
      deepStrictEqual(model.validateRoman({ ...roman, time: romanTime }), [
        { path: 'content.tokens[2].time', code: 'line.annotation.roman.time.uncovered' },
      ])
    }
  })

  it('copies timed content without merging, sorting, or trimming source fragments', () => {
    for (const model of models) {
      const tokens = [
        model.makeToken({ time: makeTimeRange({ start: 2000 }), text: ' ni' }),
        model.makeToken({ text: '  ' }),
        model.makeToken({ time: makeTimeRange({ start: 1000, end: 1800 }), text: 'hao ' }),
      ]
      const roman = model.makeRoman({ language: 'ZH-Latn', scheme: 'PINYIN', time: makeTimeRange({ start: 0 }), content: model.makeTokens(tokens) })
      const canonical = model.canonicalize(roman)
      deepStrictEqual({ language: canonical.language, scheme: canonical.scheme }, { language: 'zh-latn', scheme: 'pinyin' })
      deepStrictEqual(
        canonical.content!.tokens.map((token) => [token.text, token.time]),
        tokens.map((token) => [token.text, token.time]),
      )
      deepStrictEqual(model.text(canonical), ' ni  hao ')
      deepStrictEqual(model.canonicalize(canonical), canonical)
      canonical.time!.start = 500
      canonical.content!.tokens[0]!.time!.start = 2200
      canonical.content!.tokens[1]!.text = 'changed'
      canonical.content!.tokens.push(model.makeToken({ text: 'another' }))
      deepStrictEqual(roman.time, { start: 0 })
      deepStrictEqual(tokens[0]!.time, { start: 2000 })
      deepStrictEqual(tokens[1]!.text, '  ')
      deepStrictEqual(tokens.length, 3)
      deepStrictEqual(model.canonicalize(model.makeRoman({ content: model.makeText('') })).content, { tokens: [], text: '' })
    }
  })

  it('rejects the same variant at both scopes while treating backgrounds and schemes independently', () => {
    const time = makeTimeRange({ start: 1000, end: 2000 })
    const documentRoman = makeDocumentLineAnnotationRoman({
      language: 'ZH-LATN',
      scheme: 'PINYIN',
      content: makeDocumentLineAnnotationRomanContentText('ni'),
    })
    const documentWords = makeDocumentLineContentWords([
      makeDocumentWordNormal({
        text: 'x',
        time,
        annotation: makeDocumentWordAnnotation({
          romans: [
            makeDocumentWordAnnotationRoman({ language: 'zh-latn', scheme: 'pinyin', tokens: [makeDocumentWordAnnotationToken({ text: 'ni' })] }),
          ],
        }),
      }),
      makeDocumentWordSpace({ text: ' ' }),
    ])
    const documentAnnotation = makeDocumentLineAnnotation({ romans: [documentRoman] })
    const documentBackground = makeDocumentLineBackground({ time, content: documentWords, annotation: documentAnnotation })
    const documentLine = makeDocumentLineNormal({ time, content: documentWords, annotation: documentAnnotation, backgrounds: [documentBackground] })

    const enrichedRoman = makeEnrichedLineAnnotationRoman({
      language: 'ZH-LATN',
      scheme: 'PINYIN',
      content: makeEnrichedLineAnnotationRomanContentText('ni'),
    })
    const enrichedWords = makeEnrichedLineContentWords([
      makeEnrichedWordNormal({
        text: 'x',
        time,
        annotation: makeEnrichedWordAnnotation({
          romans: [
            makeEnrichedWordAnnotationRoman({ language: 'zh-latn', scheme: 'pinyin', tokens: [makeEnrichedWordAnnotationToken({ text: 'ni' })] }),
          ],
        }),
      }),
      makeEnrichedWordSpace({ text: ' ' }),
    ])
    const enrichedAnnotation = makeEnrichedLineAnnotation({ romans: [enrichedRoman] })
    const enrichedBackground = makeEnrichedLineBackground({ time, content: enrichedWords, annotation: enrichedAnnotation })
    const enrichedLine = makeEnrichedLineNormal({ time, content: enrichedWords, annotation: enrichedAnnotation, backgrounds: [enrichedBackground] })

    for (const diagnostics of [validateDocumentLine(documentLine, 'line', Timing.WORD), validateEnrichedLine(enrichedLine, 'line', Timing.WORD)]) {
      deepStrictEqual(
        diagnostics.map((diagnostic) => [diagnostic.path, diagnostic.code]),
        [
          ['line.annotation.romans[0]', 'line.annotation.romans.conflict'],
          ['line.backgrounds[0].annotation.romans[0]', 'line.annotation.romans.conflict'],
        ],
      )
    }
    deepStrictEqual(
      validateDocumentLine(
        {
          ...documentLine,
          annotation: undefined,
          backgrounds: [{ ...documentBackground, content: makeDocumentLineContentText('bg') }],
        },
        '',
        Timing.WORD,
      ),
      [],
    )
    deepStrictEqual(
      validateEnrichedLine(
        {
          ...enrichedLine,
          annotation: undefined,
          backgrounds: [{ ...enrichedBackground, content: makeEnrichedLineContentText('bg') }],
        },
        '',
        Timing.WORD,
      ),
      [],
    )
    deepStrictEqual(
      validateDocumentLine(
        {
          ...documentLine,
          annotation: makeDocumentLineAnnotation({ romans: [{ ...documentRoman, scheme: 'another' }] }),
          backgrounds: [],
        },
        '',
        Timing.WORD,
      ),
      [],
    )
    deepStrictEqual(
      validateEnrichedLine(
        {
          ...enrichedLine,
          annotation: makeEnrichedLineAnnotation({ romans: [{ ...enrichedRoman, scheme: 'another' }] }),
          backgrounds: [],
        },
        '',
        Timing.WORD,
      ),
      [],
    )
  })

  it('allows annotation timing without promoting the original lyric timing', () => {
    const roman = makeDocumentLineAnnotationRoman({
      content: makeDocumentLineAnnotationRomanContentTokens([
        makeDocumentLineAnnotationRomanToken({ text: 'ni ', time: makeTimeRange({ start: 1000, end: 1800 }) }),
        makeDocumentLineAnnotationRomanToken({ text: 'hao', time: makeTimeRange({ start: 2000 }) }),
      ]),
    })
    const lyric = makeDocumentLyric({
      timing: Timing.NONE,
      lines: [
        makeDocumentLineNormal({ content: makeDocumentLineContentText('original'), annotation: makeDocumentLineAnnotation({ romans: [roman] }) }),
      ],
    })
    deepStrictEqual(validateDocumentLyric(lyric), [])
    const enriched = makeEnrichedLineNormal({
      time: makeTimeRange({ start: 1200, end: 1800 }),
      content: makeEnrichedLineContentText('original'),
      annotation: makeEnrichedLineAnnotation({
        romans: [
          makeEnrichedLineAnnotationRoman({
            content: makeEnrichedLineAnnotationRomanContentTokens([
              makeEnrichedLineAnnotationRomanToken({ text: 'ni ', time: makeTimeRange({ start: 1000, end: 1800 }) }),
              makeEnrichedLineAnnotationRomanToken({ text: 'hao', time: makeTimeRange({ start: 2000 }) }),
            ]),
          }),
        ],
      }),
    })
    deepStrictEqual(validateEnrichedLine(enriched, '', Timing.LINE), [])
  })
})
