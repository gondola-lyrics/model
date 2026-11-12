import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DocumentWordType,
  EnrichedLineType,
  EnrichedLyricStatus,
  SCHEMA_VERSION,
  TimingLevel,
  canonicalizeEnrichedLine,
  canonicalizeEnrichedWord,
  makeDocumentWordNormal,
  makeDocumentWordSpace,
  makeEnrichedLineInstrumental,
  makeEnrichedLineNormal,
  makeEnrichedLyric,
  makeEnrichedWordNormal,
} from '@root/index'

describe('make', () => {
  it('stamps the schema version it was built from', () => {
    const lyric = makeEnrichedLyric({ format: 'lrc', timing: TimingLevel.NONE, status: EnrichedLyricStatus.VALID })
    strictEqual(lyric.version, SCHEMA_VERSION)
  })

  // The discriminant is stamped by the constructor, so a line can never claim a kind its fields do not match.
  it('stamps the line kind', () => {
    strictEqual(makeEnrichedLineNormal({}).type, EnrichedLineType.NORMAL)
    strictEqual(makeEnrichedLineInstrumental().type, EnrichedLineType.INSTRUMENTAL)
    strictEqual(makeDocumentWordNormal({ text: 'hi' }).type, DocumentWordType.NORMAL)
    strictEqual(makeDocumentWordSpace({ text: ' ' }).type, DocumentWordType.SPACE)
  })

  // Constructors store what they are given; canonicalizing is the only thing that rewrites a tag.
  it('stores tags as they were given', () => {
    const word = makeEnrichedWordNormal({ text: 'hi', language: 'JA-JP' })
    strictEqual(word.language, 'JA-JP')
    strictEqual(canonicalizeEnrichedWord(word).language, 'ja-jp')

    const line = makeEnrichedLineNormal({ languages: ['JA-JP'] })
    deepStrictEqual(line.languages, ['JA-JP'])
    deepStrictEqual(canonicalizeEnrichedLine(line).languages, ['ja-jp'])
  })
})
