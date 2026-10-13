import { runtime } from '@root/index'

import { describe, it } from 'node:test'
import { deepStrictEqual } from 'node:assert/strict'

const collectNodes = (node: unknown, seen = new Set<object>()): Set<object> => {
  if (node === null || typeof node !== 'object' || seen.has(node)) {
    return seen
  }
  seen.add(node)
  for (const value of Object.values(node)) {
    collectNodes(value, seen)
  }
  return seen
}

const buildLyric = (): runtime.Lyric => {
  const lines = [
    runtime.makeLineNormal({
      time: runtime.makeTimeRange({ start: 1000, end: 2000 }),
      languages: ['EN'],
      part: runtime.makePart({ type: runtime.PartType.VERSE, raw: 'Verse 1' }),
      content: runtime.makeLineContentWords([
        runtime.makeWordNormal({
          text: 'hi',
          language: 'EN',
          time: runtime.makeTimeRange({ start: 1000, end: 2000 }),
          emphasis: runtime.makeWordEmphasis({ value: true }),
        }),
      ]),
    }),
  ]
  return runtime.makeLyric({
    format: 'LRC',
    timing: runtime.Timing.WORD,
    status: runtime.LyricStatus.VALID,
    languages: runtime.deriveLanguageUsages(lines),
    lines,
  })
}

describe('canonicalize', () => {
  it('lowercases the format and the tags', () => {
    const canonical = runtime.canonicalizeLyric(buildLyric())
    deepStrictEqual(canonical.format, 'lrc')
    deepStrictEqual(canonical.lines[0]?.languages, ['en'])
    deepStrictEqual(canonical.lines[0]?.content?.words[0]?.language, 'en')
  })

  it('is idempotent', () => {
    const once = runtime.canonicalizeLyric(buildLyric())
    deepStrictEqual(runtime.canonicalizeLyric(once), once)
  })

  // Returning a copy is the stated contract, and a subobject carried over untouched is how it was broken before.
  it('shares no mutable node with the lyric it was given', () => {
    const lyric = buildLyric()
    const canonical = runtime.canonicalizeLyric(lyric)
    const nodes = collectNodes(lyric)
    const shared = [...collectNodes(canonical)].filter((node) => nodes.has(node))
    deepStrictEqual(shared, [])
  })

  it('leaves a canonical lyric valid', () => {
    deepStrictEqual(runtime.validateLyric(runtime.canonicalizeLyric(buildLyric())), [])
  })
})
