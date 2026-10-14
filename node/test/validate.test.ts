import { runtime, storage } from '@root/index'

import { describe, it } from 'node:test'
import { deepStrictEqual } from 'node:assert/strict'

const textLine = (start: number, end?: number): runtime.Line => {
  return runtime.makeLineNormal({ time: runtime.makeTimeRange({ start, end }), content: runtime.makeLineContentText('x') })
}

const lineTimed = (...lines: runtime.Line[]): runtime.Lyric => {
  return runtime.makeLyric({ format: 'lrc', timing: runtime.Timing.LINE, status: runtime.LyricStatus.VALID, lines })
}

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

  // A line other than the last ends where the timeline moves on, so one left open would be shown for the rest of the song.
  it('reports a line left open above', () => {
    const lyric = lineTimed(textLine(0, 1000), textLine(1000), textLine(2000, 3000))
    deepStrictEqual(runtime.validateLyric(lyric), [{ path: 'lines[1].time.end', code: 'lyric.line.time.end.missing' }])
  })

  // Nothing in a lyric states where it stops, so the last line is the one line whose end the data cannot carry.
  it('accepts the last line left open above', () => {
    const lyric = lineTimed(textLine(0, 1000), textLine(1000, 2000), textLine(2000))
    deepStrictEqual(runtime.validateLyric(lyric), [])
  })

  // A line carrying no range at all is already reported for that, so it is not asked for an end on top.
  it('reports a line with no range once', () => {
    const lyric = lineTimed(runtime.makeLineNormal({ content: runtime.makeLineContentText('x') }), textLine(1000, 2000))
    deepStrictEqual(runtime.validateLyric(lyric), [{ path: 'lines[0].time', code: 'lyric.timing.line.time_missing' }])
  })

  // The two layers hold the same rule in two implementations, so the storage one is checked against the same case.
  it('reports a line left open above in the storage layer', () => {
    const lyric = storage.makeLyric({
      format: 'lrc',
      timing: storage.Timing.LINE,
      lines: [
        storage.makeLineNormal({ time: storage.makeTimeRange({ start: 0 }), content: storage.makeLineContentText('x') }),
        storage.makeLineNormal({ time: storage.makeTimeRange({ start: 1000, end: 2000 }), content: storage.makeLineContentText('y') }),
      ],
    })
    deepStrictEqual(storage.validateLyric(lyric), [{ path: 'lines[0].time.end', code: 'lyric.line.time.end.missing' }])
  })
})
