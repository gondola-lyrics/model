import type { UnknownField } from '@bufbuild/protobuf'

import { runtime, storage } from '@root/index'
import { WireType } from '@bufbuild/protobuf/wire'

import { describe, it } from 'node:test'
import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict'

const buildLyric = (): runtime.Lyric => {
  const lines = [
    runtime.makeLineInstrumental({ time: runtime.makeTimeRange({ start: 0, end: 1000 }) }),
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
  return runtime.makeLyric({
    format: 'lrc',
    timing: runtime.Timing.WORD,
    status: runtime.LyricStatus.VALID,
    languages: runtime.deriveLanguageUsages(lines),
    lines,
  })
}

describe('codec', () => {
  it('round trips a runtime lyric', () => {
    const lyric = buildLyric()
    deepStrictEqual(runtime.decode(runtime.encode(lyric)), lyric)
  })

  it('round trips a storage lyric', () => {
    const lyric = storage.makeLyric({
      format: 'lrc',
      timing: storage.Timing.LINE,
      lines: [
        storage.makeLineNormal({
          time: storage.makeTimeRange({ start: 1000, end: 2000 }),
          languages: ['en'],
          content: storage.makeLineContentText('hi there'),
        }),
      ],
    })
    deepStrictEqual(storage.decode(storage.encode(lyric)), lyric)
  })

  // A submessage holding nothing but unknown fields is the only thing standing between a round trip and silent data loss.
  it('keeps a submessage carrying only unknown fields', () => {
    const unknown: UnknownField[] = [{ no: 9999, wireType: WireType.Varint, data: new Uint8Array([1]) }]
    const meta = runtime.makeMeta()
    meta.$unknown = unknown
    const canonical = runtime.canonicalizeLyric({ ...buildLyric(), meta })

    ok(canonical.meta !== undefined)
    deepStrictEqual(runtime.decode(runtime.encode(canonical)).meta?.$unknown, unknown)
  })

  it('drops a submessage that is empty for real', () => {
    strictEqual(runtime.canonicalizeLyric({ ...buildLyric(), meta: runtime.makeMeta() }).meta, undefined)
  })
})
