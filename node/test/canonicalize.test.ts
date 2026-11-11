import { describe, it } from 'node:test'
import { deepStrictEqual } from 'node:assert/strict'

import { runtime, storage } from '@root/index'

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
      part: runtime.makePart({ type: runtime.PartType.VERSE, id: 'Verse-A', raw: 'Verse 1' }),
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
    format: 'TTML',
    profile: 'AMLL',
    timing: runtime.Timing.WORD,
    status: runtime.LyricStatus.VALID,
    languages: runtime.deriveLanguageUsages(lines),
    lines,
  })
}

describe('canonicalize', () => {
  it('lowercases the format, profile and tags', () => {
    const lyric = buildLyric()
    const canonical = runtime.canonicalizeLyric(lyric)
    deepStrictEqual(canonical.format, 'ttml')
    deepStrictEqual(canonical.profile, 'amll')
    deepStrictEqual(canonical.lines[0]?.languages, ['en'])
    deepStrictEqual(canonical.lines[0]?.content?.words[0]?.language, 'en')
    deepStrictEqual(canonical.lines[0]?.part?.id, 'Verse-A')

    const persisted = storage.canonicalizeLyric(
      storage.makeLyric({
        format: 'TTML',
        profile: 'ITUNES',
        lines: [storage.makeLineNormal({ part: lyric.lines[0]?.part, content: storage.makeLineContentText('hi') })],
      }),
    )
    deepStrictEqual(persisted.format, 'ttml')
    deepStrictEqual(persisted.profile, 'itunes')
    deepStrictEqual(persisted.lines[0]?.part?.id, 'Verse-A')
  })

  it('is idempotent', () => {
    const once = runtime.canonicalizeLyric(buildLyric())
    deepStrictEqual(runtime.canonicalizeLyric(once), once)
  })

  it('canonicalizes annotation schemes while preserving constructor input', () => {
    for (const scheme of ['HEPBURN', '']) {
      const word = runtime.makeWordAnnotation({
        romans: [runtime.makeWordAnnotationRoman({ language: 'JA-Latn', scheme, tokens: [runtime.makeWordAnnotationToken({ text: 'shi' })] })],
        rubies: [runtime.makeWordAnnotationRuby({ language: 'JA-Latn', scheme, tokens: [runtime.makeWordAnnotationToken({ text: 'shi' })] })],
      })
      const line = runtime.makeLineAnnotation({ romans: [runtime.makeLineAnnotationRoman({ language: 'JA-Latn', scheme, text: 'shi' })] })
      const canonicalWord = runtime.canonicalizeWordAnnotation(word)
      const canonicalLine = runtime.canonicalizeLineAnnotation(line)
      const expected = { language: 'ja-latn', scheme: scheme === '' ? undefined : 'hepburn' }
      for (const item of [canonicalWord.romans[0]!, canonicalWord.rubies[0]!, canonicalLine.romans[0]!]) {
        deepStrictEqual({ language: item.language, scheme: item.scheme }, expected)
      }
      for (const item of [word.romans[0]!, word.rubies[0]!, line.romans[0]!]) {
        deepStrictEqual({ language: item.language, scheme: item.scheme }, { language: 'JA-Latn', scheme })
      }
    }
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
