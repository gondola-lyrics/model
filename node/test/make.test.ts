import { SCHEMA_VERSION, runtime, storage } from '@root/index'

import { describe, it } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert/strict'

describe('make', () => {
  it('stamps the schema version it was built from', () => {
    const lyric = runtime.makeLyric({ format: 'lrc', timing: runtime.Timing.NONE, status: runtime.LyricStatus.VALID })
    strictEqual(lyric.version, SCHEMA_VERSION)
  })

  // The discriminant is stamped by the constructor, so a line can never claim a kind its fields do not match.
  it('stamps the line kind', () => {
    strictEqual(runtime.makeLineNormal({}).type, runtime.LineType.NORMAL)
    strictEqual(runtime.makeLineInstrumental().type, runtime.LineType.INSTRUMENTAL)
    strictEqual(storage.makeWordNormal({ text: 'hi' }).type, storage.WordType.NORMAL)
    strictEqual(storage.makeWordSpace({ text: ' ' }).type, storage.WordType.SPACE)
  })

  // Constructors store what they are given; canonicalizing is the only thing that rewrites a tag.
  it('stores tags as they were given', () => {
    const word = runtime.makeWordNormal({ text: 'hi', language: 'JA-JP' })
    strictEqual(word.language, 'JA-JP')
    strictEqual(runtime.canonicalizeWord(word).language, 'ja-jp')

    const line = runtime.makeLineNormal({ languages: ['JA-JP'] })
    deepStrictEqual(line.languages, ['JA-JP'])
    deepStrictEqual(runtime.canonicalizeLine(line).languages, ['ja-jp'])
  })
})
