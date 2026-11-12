import { describe, it } from 'node:test'
import { deepStrictEqual } from 'node:assert/strict'

import { enriched, document } from '@root/index'

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

const buildLyric = (): enriched.Lyric => {
  const lines = [
    enriched.makeLineNormal({
      time: enriched.makeTimeRange({ start: 1000, end: 2000 }),
      languages: ['EN'],
      part: enriched.makePart({ type: enriched.PartType.VERSE, id: 'Verse-A', raw: 'Verse 1' }),
      content: enriched.makeLineContentWords([
        enriched.makeWordNormal({
          text: 'hi',
          language: 'EN',
          time: enriched.makeTimeRange({ start: 1000, end: 2000 }),
          emphasis: enriched.makeWordEmphasis({ value: true }),
        }),
      ]),
    }),
  ]
  return enriched.makeLyric({
    format: 'TTML',
    profile: 'AMLL',
    timing: enriched.Timing.WORD,
    status: enriched.LyricStatus.VALID,
    languages: enriched.deriveLanguageUsages(lines),
    lines,
  })
}

describe('canonicalize', () => {
  it('lowercases the format, profile and tags', () => {
    const lyric = buildLyric()
    const canonical = enriched.canonicalizeLyric(lyric)
    deepStrictEqual(canonical.format, 'ttml')
    deepStrictEqual(canonical.profile, 'amll')
    deepStrictEqual(canonical.lines[0]?.languages, ['en'])
    deepStrictEqual(canonical.lines[0]?.content?.words[0]?.language, 'en')
    deepStrictEqual(canonical.lines[0]?.part?.id, 'Verse-A')

    const persisted = document.canonicalizeLyric(
      document.makeLyric({
        format: 'TTML',
        profile: 'ITUNES',
        lines: [document.makeLineNormal({ part: lyric.lines[0]?.part, content: document.makeLineContentText('hi') })],
      }),
    )
    deepStrictEqual(persisted.format, 'ttml')
    deepStrictEqual(persisted.profile, 'itunes')
    deepStrictEqual(persisted.lines[0]?.part?.id, 'Verse-A')
  })

  it('is idempotent', () => {
    const once = enriched.canonicalizeLyric(buildLyric())
    deepStrictEqual(enriched.canonicalizeLyric(once), once)
  })

  it('preserves explicit emphasis decisions and origin while dropping empty emphasis', () => {
    const emphases = [
      enriched.makeWordEmphasis(),
      enriched.makeWordEmphasis({ value: false }),
      enriched.makeWordEmphasis({ value: true }),
      enriched.makeWordEmphasis({ value: false, derived: false }),
      enriched.makeWordEmphasis({ value: false, derived: true }),
      enriched.makeWordEmphasis({ value: true, derived: false }),
      enriched.makeWordEmphasis({ value: true, derived: true }),
    ]
    const canonical = emphases.map((emphasis) => {
      return enriched.canonicalizeWord(enriched.makeWordNormal({ text: 'ah', emphasis })).emphasis
    })
    deepStrictEqual(canonical, [
      undefined,
      { value: false },
      { value: true },
      { value: false, derived: false },
      { value: false, derived: true },
      { value: true, derived: false },
      { value: true, derived: true },
    ])
  })

  it('canonicalizes annotation schemes while preserving constructor input', () => {
    for (const model of [document, enriched]) {
      for (const scheme of ['HEPBURN', '']) {
        const word = model.makeWordAnnotation({
          romans: [model.makeWordAnnotationRoman({ language: 'JA-Latn', scheme, tokens: [model.makeWordAnnotationToken({ text: 'shi' })] })],
          rubies: [model.makeWordAnnotationRuby({ language: 'JA-Latn', scheme, tokens: [model.makeWordAnnotationToken({ text: 'shi' })] })],
        })
        const line = model.makeLineAnnotation({ romans: [model.makeLineAnnotationRoman({ language: 'JA-Latn', scheme, text: 'shi' })] })
        const canonicalWord = model.canonicalizeWordAnnotation(word)
        const canonicalLine = model.canonicalizeLineAnnotation(line)
        const expected = { language: 'ja-latn', scheme: scheme === '' ? undefined : 'hepburn' }
        for (const item of [canonicalWord.romans[0]!, canonicalWord.rubies[0]!, canonicalLine.romans[0]!]) {
          deepStrictEqual({ language: item.language, scheme: item.scheme }, expected)
        }
        for (const item of [word.romans[0]!, word.rubies[0]!, line.romans[0]!]) {
          deepStrictEqual({ language: item.language, scheme: item.scheme }, { language: 'JA-Latn', scheme })
        }
      }
    }
  })

  it('canonicalizes document annotations without losing timing or explicit false', () => {
    const time = document.makeTimeRange({ start: 1000, end: 2000 })
    const token = document.makeWordAnnotationToken({ time, text: 'shi' })
    const word = document.makeWordNormal({
      text: 'x',
      time,
      emphasis: false,
      annotation: document.makeWordAnnotation({
        romans: [document.makeWordAnnotationRoman({ language: 'JA-Latn', scheme: 'HEPBURN', tokens: [token] }), document.makeWordAnnotationRoman()],
      }),
    })
    const canonical = document.canonicalizeWord(word)
    deepStrictEqual(canonical.annotation?.romans.length, 1)
    const roman = canonical.annotation!.romans[0]!
    deepStrictEqual(
      { language: roman.language, scheme: roman.scheme, tokens: roman.tokens },
      { language: 'ja-latn', scheme: 'hepburn', tokens: [token] },
    )
    deepStrictEqual(canonical.emphasis, false)
    deepStrictEqual(document.resolveAnnotationTokenTime(token, canonical.annotation!.romans[0]!, canonical), time)
    deepStrictEqual(document.validateWord(canonical, '', document.Timing.WORD), [])
    const originalNodes = collectNodes(word)
    deepStrictEqual(
      [...collectNodes(canonical)].filter((node) => originalNodes.has(node)),
      [],
    )
  })

  // Returning a copy is the stated contract, and a subobject carried over untouched is how it was broken before.
  it('shares no mutable node with the lyric it was given', () => {
    const lyric = buildLyric()
    const canonical = enriched.canonicalizeLyric(lyric)
    const nodes = collectNodes(lyric)
    const shared = [...collectNodes(canonical)].filter((node) => nodes.has(node))
    deepStrictEqual(shared, [])
  })

  it('leaves a canonical lyric valid', () => {
    deepStrictEqual(enriched.validateLyric(enriched.canonicalizeLyric(buildLyric())), [])
  })
})
