import type { EnrichedLyric } from '@root/index'

import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  TimingLevel,
  EnrichedLyricStatus,
  canonicalizeEnrichedLyric,
  deriveEnrichedLanguageUsages,
  decodeDocumentLyric,
  decodeEnrichedLyric,
  encodeDocumentLyric,
  encodeEnrichedLyric,
  makeDocumentLineContentText,
  makeDocumentLineNormal,
  makeDocumentLyric,
  makeEnrichedLineContentWords,
  makeEnrichedLineInstrumental,
  makeEnrichedLineNormal,
  makeEnrichedLyric,
  makeEnrichedWordNormal,
  makeEnrichedWordSpace,
  makeMeta,
  makeTimeRange,
} from '@root/index'

const buildLyric = (): EnrichedLyric => {
  const lines = [
    makeEnrichedLineInstrumental({ time: makeTimeRange({ start: 0, end: 1000 }) }),
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
  return makeEnrichedLyric({
    format: 'lrc',
    timing: TimingLevel.WORD,
    status: EnrichedLyricStatus.VALID,
    languageUsages: deriveEnrichedLanguageUsages(lines),
    lines,
  })
}

describe('codec', () => {
  it('round trips an enriched lyric', () => {
    const lyric = buildLyric()
    deepStrictEqual(decodeEnrichedLyric(encodeEnrichedLyric(lyric)), lyric)
  })

  it('round trips a document lyric', () => {
    const lyric = makeDocumentLyric({
      format: 'lrc',
      timing: TimingLevel.LINE,
      lines: [
        makeDocumentLineNormal({
          time: makeTimeRange({ start: 1000, end: 2000 }),
          languages: ['en'],
          content: makeDocumentLineContentText('hi there'),
        }),
      ],
    })
    deepStrictEqual(decodeDocumentLyric(encodeDocumentLyric(lyric)), lyric)
  })

  it('drops a submessage that is empty for real', () => {
    strictEqual(canonicalizeEnrichedLyric({ ...buildLyric(), meta: makeMeta() }).meta, undefined)
  })
})
