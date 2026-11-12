import type { EnrichedLyric } from '@root/index'

import { deepStrictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EnrichedLyricStatus,
  PartType,
  TimingLevel,
  canonicalizeDocumentLineAnnotation,
  canonicalizeDocumentLyric,
  canonicalizeDocumentWord,
  canonicalizeDocumentWordAnnotation,
  canonicalizeEnrichedLineAnnotation,
  canonicalizeEnrichedLyric,
  canonicalizeEnrichedWord,
  canonicalizeEnrichedWordAnnotation,
  deriveEnrichedLanguageUsages,
  makeDocumentLineAnnotation,
  makeDocumentLineAnnotationRoman,
  makeDocumentLineAnnotationRomanContentText,
  makeDocumentLineContentText,
  makeDocumentLineNormal,
  makeDocumentLyric,
  makeDocumentWordAnnotation,
  makeDocumentWordAnnotationRoman,
  makeDocumentWordAnnotationRuby,
  makeDocumentWordNormal,
  makeEnrichedLineAnnotation,
  makeEnrichedLineAnnotationRoman,
  makeEnrichedLineAnnotationRomanContentText,
  makeEnrichedLineContentWords,
  makeEnrichedLineNormal,
  makeEnrichedLyric,
  makeEnrichedWordAnnotation,
  makeEnrichedWordAnnotationRoman,
  makeEnrichedWordAnnotationRuby,
  makeTextToken,
  makeEnrichedWordEmphasis,
  makeEnrichedWordNormal,
  makePart,
  makeTimeRange,
  resolveDocumentAnnotationTokenTime,
  validateDocumentWord,
  validateEnrichedLyric,
} from '@root/index'

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

const buildLyric = (): EnrichedLyric => {
  const lines = [
    makeEnrichedLineNormal({
      time: makeTimeRange({ start: 1000, end: 2000 }),
      languages: ['EN'],
      part: makePart({ type: PartType.VERSE, id: 'Verse-A', raw: 'Verse 1' }),
      content: makeEnrichedLineContentWords([
        makeEnrichedWordNormal({
          text: 'hi',
          language: 'EN',
          time: makeTimeRange({ start: 1000, end: 2000 }),
          emphasis: makeEnrichedWordEmphasis({ value: true }),
        }),
      ]),
    }),
  ]
  return makeEnrichedLyric({
    format: 'TTML',
    profile: 'AMLL',
    timing: TimingLevel.WORD,
    status: EnrichedLyricStatus.VALID,
    languageUsages: deriveEnrichedLanguageUsages(lines),
    lines,
  })
}

describe('canonicalize', () => {
  it('lowercases the format, profile and tags', () => {
    const lyric = buildLyric()
    const canonical = canonicalizeEnrichedLyric(lyric)
    deepStrictEqual(canonical.format, 'ttml')
    deepStrictEqual(canonical.profile, 'amll')
    deepStrictEqual(canonical.lines[0]?.languages, ['en'])
    deepStrictEqual(canonical.lines[0]?.content?.words[0]?.language, 'en')
    deepStrictEqual(canonical.lines[0]?.part?.id, 'Verse-A')

    const persisted = canonicalizeDocumentLyric(
      makeDocumentLyric({
        format: 'TTML',
        profile: 'ITUNES',
        lines: [makeDocumentLineNormal({ part: lyric.lines[0]?.part, content: makeDocumentLineContentText('hi') })],
      }),
    )
    deepStrictEqual(persisted.format, 'ttml')
    deepStrictEqual(persisted.profile, 'itunes')
    deepStrictEqual(persisted.lines[0]?.part?.id, 'Verse-A')
  })

  it('is idempotent', () => {
    const once = canonicalizeEnrichedLyric(buildLyric())
    deepStrictEqual(canonicalizeEnrichedLyric(once), once)
  })

  it('preserves explicit emphasis decisions and origin while dropping empty emphasis', () => {
    const emphases = [
      makeEnrichedWordEmphasis(),
      makeEnrichedWordEmphasis({ value: false }),
      makeEnrichedWordEmphasis({ value: true }),
      makeEnrichedWordEmphasis({ value: false, derived: false }),
      makeEnrichedWordEmphasis({ value: false, derived: true }),
      makeEnrichedWordEmphasis({ value: true, derived: false }),
      makeEnrichedWordEmphasis({ value: true, derived: true }),
    ]
    const canonical = emphases.map((emphasis) => {
      return canonicalizeEnrichedWord(makeEnrichedWordNormal({ text: 'ah', emphasis })).emphasis
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
    for (const model of [
      {
        makeWordAnnotation: makeDocumentWordAnnotation,
        makeWordAnnotationRoman: makeDocumentWordAnnotationRoman,
        makeWordAnnotationRuby: makeDocumentWordAnnotationRuby,
        makeLineAnnotation: makeDocumentLineAnnotation,
        makeLineAnnotationRoman: makeDocumentLineAnnotationRoman,
        makeLineAnnotationRomanContentText: makeDocumentLineAnnotationRomanContentText,
        canonicalizeWordAnnotation: canonicalizeDocumentWordAnnotation,
        canonicalizeLineAnnotation: canonicalizeDocumentLineAnnotation,
      },
      {
        makeWordAnnotation: makeEnrichedWordAnnotation,
        makeWordAnnotationRoman: makeEnrichedWordAnnotationRoman,
        makeWordAnnotationRuby: makeEnrichedWordAnnotationRuby,
        makeLineAnnotation: makeEnrichedLineAnnotation,
        makeLineAnnotationRoman: makeEnrichedLineAnnotationRoman,
        makeLineAnnotationRomanContentText: makeEnrichedLineAnnotationRomanContentText,
        canonicalizeWordAnnotation: canonicalizeEnrichedWordAnnotation,
        canonicalizeLineAnnotation: canonicalizeEnrichedLineAnnotation,
      },
    ]) {
      for (const scheme of ['HEPBURN', '']) {
        const word = model.makeWordAnnotation({
          romans: [model.makeWordAnnotationRoman({ language: 'JA-Latn', scheme, tokens: [makeTextToken({ text: 'shi' })] })],
          rubies: [model.makeWordAnnotationRuby({ language: 'JA-Latn', scheme, tokens: [makeTextToken({ text: 'shi' })] })],
        })
        const line = model.makeLineAnnotation({
          romans: [model.makeLineAnnotationRoman({ language: 'JA-Latn', scheme, content: model.makeLineAnnotationRomanContentText('shi') })],
        })
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
    const time = makeTimeRange({ start: 1000, end: 2000 })
    const token = makeTextToken({ time, text: 'shi' })
    const word = makeDocumentWordNormal({
      text: 'x',
      time,
      emphasis: false,
      annotation: makeDocumentWordAnnotation({
        romans: [makeDocumentWordAnnotationRoman({ language: 'JA-Latn', scheme: 'HEPBURN', tokens: [token] }), makeDocumentWordAnnotationRoman()],
      }),
    })
    const canonical = canonicalizeDocumentWord(word)
    deepStrictEqual(canonical.annotation?.romans.length, 1)
    const roman = canonical.annotation!.romans[0]!
    deepStrictEqual(
      { language: roman.language, scheme: roman.scheme, tokens: roman.tokens },
      { language: 'ja-latn', scheme: 'hepburn', tokens: [token] },
    )
    deepStrictEqual(canonical.emphasis, false)
    deepStrictEqual(resolveDocumentAnnotationTokenTime(token, canonical.annotation!.romans[0]!, canonical), time)
    deepStrictEqual(validateDocumentWord(canonical, '', TimingLevel.WORD), [])
    const originalNodes = collectNodes(word)
    deepStrictEqual(
      [...collectNodes(canonical)].filter((node) => originalNodes.has(node)),
      [],
    )
  })

  // Returning a copy is the stated contract, and a subobject carried over untouched is how it was broken before.
  it('shares no mutable node with the lyric it was given', () => {
    const lyric = buildLyric()
    const canonical = canonicalizeEnrichedLyric(lyric)
    const nodes = collectNodes(lyric)
    const shared = [...collectNodes(canonical)].filter((node) => nodes.has(node))
    deepStrictEqual(shared, [])
  })

  it('leaves a canonical lyric valid', () => {
    deepStrictEqual(validateEnrichedLyric(canonicalizeEnrichedLyric(buildLyric())), [])
  })
})
