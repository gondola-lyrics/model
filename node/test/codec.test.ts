import { describe, it } from 'node:test'
import { deepStrictEqual, strictEqual } from 'node:assert/strict'

import { enriched, document } from '@root/index'

const buildLyric = (): enriched.Lyric => {
  const lines = [
    enriched.makeLineInstrumental({ time: enriched.makeTimeRange({ start: 0, end: 1000 }) }),
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
  return enriched.makeLyric({
    format: 'lrc',
    timing: enriched.Timing.WORD,
    status: enriched.LyricStatus.VALID,
    languages: enriched.deriveLanguageUsages(lines),
    lines,
  })
}

describe('codec', () => {
  it('round trips an enriched lyric', () => {
    const lyric = buildLyric()
    deepStrictEqual(enriched.decode(enriched.encode(lyric)), lyric)
  })

  it('round trips a document lyric', () => {
    const lyric = document.makeLyric({
      format: 'lrc',
      timing: document.Timing.LINE,
      lines: [
        document.makeLineNormal({
          time: document.makeTimeRange({ start: 1000, end: 2000 }),
          languages: ['en'],
          content: document.makeLineContentText('hi there'),
        }),
      ],
    })
    deepStrictEqual(document.decode(document.encode(lyric)), lyric)
  })

  it('drops a submessage that is empty for real', () => {
    strictEqual(enriched.canonicalizeLyric({ ...buildLyric(), meta: enriched.makeMeta() }).meta, undefined)
  })
})
