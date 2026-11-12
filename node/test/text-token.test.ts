import { deepStrictEqual, notStrictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  canonicalizeDocumentLineAnnotationRoman,
  canonicalizeDocumentWordAnnotation,
  canonicalizeEnrichedLineAnnotationRoman,
  canonicalizeEnrichedWordAnnotation,
  canonicalizeTextToken,
  makeDocumentLineAnnotationRoman,
  makeDocumentLineAnnotationRomanContentTokens,
  makeDocumentWordAnnotation,
  makeDocumentWordAnnotationRoman,
  makeDocumentWordAnnotationRuby,
  makeEnrichedLineAnnotationRoman,
  makeEnrichedLineAnnotationRomanContentTokens,
  makeEnrichedWordAnnotation,
  makeEnrichedWordAnnotationRoman,
  makeEnrichedWordAnnotationRuby,
  makeTextToken,
  makeTimeRange,
  validateDocumentLineAnnotationRoman,
  validateDocumentWordAnnotation,
  validateEnrichedLineAnnotationRoman,
  validateEnrichedWordAnnotation,
  validateTextToken,
} from '@root/index'

describe('text tokens', () => {
  it('validates extension keys through shared and containing helpers', () => {
    const token = makeTextToken({ text: 'ni', time: makeTimeRange({ start: 1000, end: 1800 }), extra: { '': 'value' } })
    deepStrictEqual(validateTextToken(token, 'token'), [{ path: 'token.extra', code: 'text.token.extra.key.empty' }])
    const documentWords = makeDocumentWordAnnotation({
      romans: [makeDocumentWordAnnotationRoman({ tokens: [token] })],
      rubies: [makeDocumentWordAnnotationRuby({ tokens: [token] })],
    })
    const enrichedWords = makeEnrichedWordAnnotation({
      romans: [makeEnrichedWordAnnotationRoman({ tokens: [token] })],
      rubies: [makeEnrichedWordAnnotationRuby({ tokens: [token] })],
    })
    const documentLine = makeDocumentLineAnnotationRoman({ content: makeDocumentLineAnnotationRomanContentTokens([token]) })
    const enrichedLine = makeEnrichedLineAnnotationRoman({ content: makeEnrichedLineAnnotationRomanContentTokens([token]) })
    const wordErrors = [
      { path: 'rubies[0].tokens[0].extra', code: 'text.token.extra.key.empty' },
      { path: 'romans[0].tokens[0].extra', code: 'text.token.extra.key.empty' },
    ]
    deepStrictEqual(validateDocumentWordAnnotation(documentWords), wordErrors)
    deepStrictEqual(validateEnrichedWordAnnotation(enrichedWords), wordErrors)
    const lineErrors = [{ path: 'content.tokens[0].extra', code: 'text.token.extra.key.empty' }]
    deepStrictEqual(validateDocumentLineAnnotationRoman(documentLine), lineErrors)
    deepStrictEqual(validateEnrichedLineAnnotationRoman(enrichedLine), lineErrors)
    deepStrictEqual(validateTextToken(makeTextToken({ extra: { ' ': '', Unknown: '', unknown: 'value' } })), [])
    deepStrictEqual(validateTextToken(makeTextToken({ time: { start: 2000, end: 1000 } }), 'token'), [
      { path: 'token.time', code: 'time.range.end.before_start' },
    ])
  })

  it('copies timing and extensions through every token container', () => {
    const extra: Record<string, string> = { 'ttml:style-ref': 'style-1', Case: '', case: 'lower', time: 'metadata', text: 'metadata' }
    Object.defineProperty(extra, '__proto__', { value: 'kept', enumerable: true })
    const token = makeTextToken({ time: { start: 1000 }, text: ' ni ', extra })
    const documentWord = canonicalizeDocumentWordAnnotation(
      makeDocumentWordAnnotation({
        romans: [makeDocumentWordAnnotationRoman({ tokens: [token] })],
        rubies: [makeDocumentWordAnnotationRuby({ tokens: [token] })],
      }),
    )
    const enrichedWord = canonicalizeEnrichedWordAnnotation(
      makeEnrichedWordAnnotation({
        romans: [makeEnrichedWordAnnotationRoman({ tokens: [token] })],
        rubies: [makeEnrichedWordAnnotationRuby({ tokens: [token] })],
      }),
    )
    const documentLine = canonicalizeDocumentLineAnnotationRoman(
      makeDocumentLineAnnotationRoman({ content: makeDocumentLineAnnotationRomanContentTokens([token]) }),
    )
    const enrichedLine = canonicalizeEnrichedLineAnnotationRoman(
      makeEnrichedLineAnnotationRoman({ content: makeEnrichedLineAnnotationRomanContentTokens([token]) }),
    )
    const canonical = [
      canonicalizeTextToken(token),
      ...documentWord.romans[0]!.tokens,
      ...documentWord.rubies[0]!.tokens,
      ...enrichedWord.romans[0]!.tokens,
      ...enrichedWord.rubies[0]!.tokens,
      ...documentLine.content!.tokens,
      ...enrichedLine.content!.tokens,
    ]
    for (const copy of canonical) {
      deepStrictEqual(copy, token)
      notStrictEqual(copy, token)
      notStrictEqual(copy.time, token.time)
      notStrictEqual(copy.extra, extra)
      copy.extra.Case = 'changed'
      copy.time!.start = 2000
    }
    deepStrictEqual(token.time, { start: 1000 })
    deepStrictEqual(token.text, ' ni ')
    deepStrictEqual(extra.Case, '')
    deepStrictEqual(Object.getOwnPropertyDescriptor(extra, '__proto__')?.value, 'kept')
  })

  it('preserves extension-only tokens while retaining each container content contract', () => {
    const token = makeTextToken({ extra: { source: '' } })
    const tokens = [makeTextToken(), token]
    const expectedTokens = [{ text: '', time: undefined, extra: { source: '' } }]
    const documentWord = canonicalizeDocumentWordAnnotation(makeDocumentWordAnnotation({ romans: [makeDocumentWordAnnotationRoman({ tokens })] }))
    const enrichedWord = canonicalizeEnrichedWordAnnotation(makeEnrichedWordAnnotation({ romans: [makeEnrichedWordAnnotationRoman({ tokens })] }))
    deepStrictEqual(documentWord.romans[0]!.tokens, expectedTokens)
    deepStrictEqual(enrichedWord.romans[0]!.tokens, expectedTokens)
    deepStrictEqual(validateDocumentWordAnnotation(documentWord), [])
    deepStrictEqual(validateEnrichedWordAnnotation(enrichedWord), [])
    const documentLine = canonicalizeDocumentLineAnnotationRoman(
      makeDocumentLineAnnotationRoman({ content: makeDocumentLineAnnotationRomanContentTokens(tokens) }),
    )
    const enrichedLine = canonicalizeEnrichedLineAnnotationRoman(
      makeEnrichedLineAnnotationRoman({ content: makeEnrichedLineAnnotationRomanContentTokens(tokens) }),
    )
    deepStrictEqual(documentLine.content!.tokens, expectedTokens)
    deepStrictEqual(enrichedLine.content!.tokens, expectedTokens)
    const expected = [
      { path: 'content.tokens', code: 'line.annotation.roman.content.tokens.time.missing' },
      { path: 'content.tokens[0].text', code: 'line.annotation.roman.token.text.empty' },
    ]
    deepStrictEqual(validateDocumentLineAnnotationRoman(documentLine), expected)
    deepStrictEqual(validateEnrichedLineAnnotationRoman(enrichedLine), expected)
    const metadataTime = makeTextToken({ text: 'ni', extra: { time: '1000', text: 'other' } })
    deepStrictEqual(validateTextToken(metadataTime), [])
    deepStrictEqual(
      validateDocumentLineAnnotationRoman(makeDocumentLineAnnotationRoman({ content: makeDocumentLineAnnotationRomanContentTokens([metadataTime]) })),
      [{ path: 'content.tokens', code: 'line.annotation.roman.content.tokens.time.missing' }],
    )
  })
})
