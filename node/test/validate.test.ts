import { runtime, storage } from '@root/index'

import { describe, it } from 'node:test'
import { deepStrictEqual } from 'node:assert/strict'

describe('validate', () => {
  it('accepts a word-level lyric', () => {
    const lines = [
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
    const lyric = runtime.makeLyric({
      format: 'lrc',
      timing: runtime.Timing.WORD,
      status: runtime.LyricStatus.VALID,
      languages: runtime.deriveLanguageUsages(lines),
      lines,
    })
    deepStrictEqual(runtime.validateLyric(lyric), [])
  })

  // The codes are a contract the other bindings copy verbatim, so they are asserted as the strings they are.
  it('reports an undeclared timing', () => {
    const lyric = storage.makeLyric({
      format: 'lrc',
      lines: [
        storage.makeLineNormal({
          time: storage.makeTimeRange({ start: 1000 }),
          languages: ['en'],
          content: storage.makeLineContentText('hi there'),
        }),
      ],
    })
    deepStrictEqual(storage.validateLyric(lyric), [{ path: 'timing', code: 'lyric.timing.unspecified' }])
  })

  it('reports undeclared languages and an unsplit word', () => {
    const lyric = runtime.makeLyric({
      format: 'lrc',
      timing: runtime.Timing.WORD,
      status: runtime.LyricStatus.VALID,
      lines: [
        runtime.makeLineNormal({
          time: runtime.makeTimeRange({ start: 1000, end: 2000 }),
          languages: ['en'],
          content: runtime.makeLineContentWords([
            runtime.makeWordNormal({ text: 'hi there', language: 'en', time: runtime.makeTimeRange({ start: 1000, end: 2000 }) }),
          ]),
        }),
      ],
    })
    deepStrictEqual(runtime.validateLyric(lyric), [
      { path: 'languages', code: 'lyric.languages.mismatch' },
      { path: 'lines[0].content.words[0].text', code: 'word.text.separator' },
    ])
  })

  // An untimed lyric marks out no stretches, so it reports the line itself instead of asking it for a range it may not have.
  it('reports an instrumental line in an untimed lyric', () => {
    const lyric = runtime.makeLyric({
      format: 'lrc',
      timing: runtime.Timing.NONE,
      status: runtime.LyricStatus.VALID,
      lines: [runtime.makeLineInstrumental()],
    })
    deepStrictEqual(runtime.validateLyric(lyric), [{ path: 'lines[0].type', code: 'lyric.timing.none.instrumental' }])
  })
})
