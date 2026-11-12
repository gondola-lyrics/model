import { describe, it } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert/strict'

import { SCHEMA_VERSION, enriched, document } from '@root/index'

describe('make', () => {
  it('stamps the schema version it was built from', () => {
    const lyric = enriched.makeLyric({ format: 'lrc', timing: enriched.Timing.NONE, status: enriched.LyricStatus.VALID })
    strictEqual(lyric.version, SCHEMA_VERSION)
  })

  // The discriminant is stamped by the constructor, so a line can never claim a kind its fields do not match.
  it('stamps the line kind', () => {
    strictEqual(enriched.makeLineNormal({}).type, enriched.LineType.NORMAL)
    strictEqual(enriched.makeLineInstrumental().type, enriched.LineType.INSTRUMENTAL)
    strictEqual(document.makeWordNormal({ text: 'hi' }).type, document.WordType.NORMAL)
    strictEqual(document.makeWordSpace({ text: ' ' }).type, document.WordType.SPACE)
  })

  // Constructors store what they are given; canonicalizing is the only thing that rewrites a tag.
  it('stores tags as they were given', () => {
    const word = enriched.makeWordNormal({ text: 'hi', language: 'JA-JP' })
    strictEqual(word.language, 'JA-JP')
    strictEqual(enriched.canonicalizeWord(word).language, 'ja-jp')

    const line = enriched.makeLineNormal({ languages: ['JA-JP'] })
    deepStrictEqual(line.languages, ['JA-JP'])
    deepStrictEqual(enriched.canonicalizeLine(line).languages, ['ja-jp'])
  })
})
