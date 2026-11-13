import type { Diagnostic, DocumentLine, EnrichedLine, Part, TimeRange } from '@root/index'

import { deepStrictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EnrichedLyricStatus,
  PartType,
  TimingLevel,
  canonicalizeDocumentLine,
  canonicalizeDocumentLyric,
  canonicalizeEnrichedLine,
  canonicalizeEnrichedLyric,
  makeDocumentLineBackground,
  makeDocumentLineContentText,
  makeDocumentLineNormal,
  makeDocumentLyric,
  makeEnrichedLanguageUsage,
  makeEnrichedLineBackground,
  makeEnrichedLineContentText,
  makeEnrichedLineNormal,
  makeEnrichedLyric,
  makePart,
  makeTimeRange,
  orderDocumentLine,
  orderDocumentLyric,
  orderEnrichedLanguageUsages,
  orderEnrichedLine,
  orderEnrichedLyric,
  validateDocumentLyric,
  validateEnrichedLyric,
} from '@root/index'

const registerOrderTests = <
  Content,
  Background extends { id: string },
  Line extends { id: string; backgrounds: Background[] },
  Lyric extends { lines: Line[] },
>(model: {
  name: string
  makeLine: (init: { id?: string; part?: Part; time?: TimeRange | undefined; content: Content; backgrounds?: Background[] }) => Line
  makeBackground: (init: { id: string; time: TimeRange; content: Content }) => Background
  makeText: (text: string) => Content
  makeLyric: (lines: Line[]) => Lyric
  orderLine: (line: Line) => Line
  canonicalizeLine: (line: Line) => Line
  orderLyric: (lyric: Lyric) => Lyric
  canonicalizeLyric: (lyric: Lyric) => Lyric
  validateLyric: (lyric: Lyric) => Diagnostic[]
}) => {
  it(`preserves contiguous parts with equal starts in ${model.name} lyrics`, () => {
    const verse = makePart({ type: PartType.VERSE, id: 'verse' })
    const chorus = makePart({ type: PartType.CHORUS, id: 'chorus' })
    const lines = [
      model.makeLine({ id: 'a1', part: verse, time: makeTimeRange({ start: 0, end: 1000 }), content: model.makeText('one') }),
      model.makeLine({ id: 'a2', part: verse, time: makeTimeRange({ start: 0, end: 3000 }), content: model.makeText('two') }),
      model.makeLine({ id: 'b1', part: chorus, time: makeTimeRange({ start: 0, end: 2000 }), content: model.makeText('three') }),
    ]
    const lyric = model.makeLyric(lines)
    const original = structuredClone(lyric)
    deepStrictEqual(model.validateLyric(lyric), [])

    for (const transform of [model.orderLyric, model.canonicalizeLyric]) {
      const result = transform(lyric)
      deepStrictEqual(model.validateLyric(result), [])
      deepStrictEqual(
        result.lines.map((line) => line.id),
        ['a1', 'a2', 'b1'],
      )
      deepStrictEqual(lyric, original)
    }
  })

  it(`preserves equal-start background order in ${model.name} helpers`, () => {
    const backgrounds = [
      model.makeBackground({ id: 'long', time: makeTimeRange({ start: 100, end: 800 }), content: model.makeText('long') }),
      model.makeBackground({ id: 'short', time: makeTimeRange({ start: 100, end: 300 }), content: model.makeText('short') }),
      model.makeBackground({ id: 'empty', time: makeTimeRange({ start: 100, end: 100 }), content: model.makeText('empty') }),
    ]
    const line = model.makeLine({ time: makeTimeRange({ start: 0, end: 1000 }), content: model.makeText('lead'), backgrounds })
    const lyric = model.makeLyric([line])
    const original = structuredClone(lyric)
    deepStrictEqual(model.validateLyric(lyric), [])

    for (const transform of [model.orderLine, model.canonicalizeLine]) {
      const result = transform(line)
      deepStrictEqual(
        result.backgrounds.map((background) => background.id),
        ['long', 'short', 'empty'],
      )
      deepStrictEqual(model.validateLyric(model.makeLyric([result])), [])
      deepStrictEqual(lyric, original)
    }
  })

  it(`orders starts stably and keeps unusable ranges last in ${model.name} lyrics`, () => {
    const ranges = [
      { id: 'untimed-first', time: undefined },
      { id: 'later', time: makeTimeRange({ start: 2000, end: 3000 }) },
      { id: 'reversed', time: makeTimeRange({ start: 500, end: 100 }) },
      { id: 'open', time: makeTimeRange({ start: 1000 }) },
      { id: 'not-a-number', time: makeTimeRange({ start: Number.NaN }) },
      { id: 'closed', time: makeTimeRange({ start: 1000, end: 1500 }) },
      { id: 'overflow', time: makeTimeRange({ start: 100, end: 2 ** 31 }) },
      { id: 'untimed-second', time: undefined },
      { id: 'empty', time: makeTimeRange({ start: 1000, end: 1000 }) },
    ]
    const lyric = model.makeLyric(ranges.map(({ id, time }) => model.makeLine({ id, time, content: model.makeText(id) })))
    const original = structuredClone(lyric)

    for (const transform of [model.orderLyric, model.canonicalizeLyric]) {
      const result = transform(lyric)
      deepStrictEqual(
        result.lines.map((line) => line.id),
        ['open', 'closed', 'empty', 'later', 'untimed-first', 'reversed', 'not-a-number', 'overflow', 'untimed-second'],
      )
      deepStrictEqual(lyric, original)
    }
  })
}

describe('order', () => {
  registerOrderTests({
    name: 'document',
    makeLine: makeDocumentLineNormal,
    makeBackground: makeDocumentLineBackground,
    makeText: makeDocumentLineContentText,
    makeLyric: (lines: DocumentLine[]) => {
      return makeDocumentLyric({ timing: TimingLevel.LINE, lines })
    },
    orderLine: orderDocumentLine,
    canonicalizeLine: canonicalizeDocumentLine,
    orderLyric: orderDocumentLyric,
    canonicalizeLyric: canonicalizeDocumentLyric,
    validateLyric: validateDocumentLyric,
  })
  registerOrderTests({
    name: 'enriched',
    makeLine: makeEnrichedLineNormal,
    makeBackground: makeEnrichedLineBackground,
    makeText: makeEnrichedLineContentText,
    makeLyric: (lines: EnrichedLine[]) => {
      return makeEnrichedLyric({ status: EnrichedLyricStatus.VALID, timing: TimingLevel.LINE, lines })
    },
    orderLine: orderEnrichedLine,
    canonicalizeLine: canonicalizeEnrichedLine,
    orderLyric: orderEnrichedLyric,
    canonicalizeLyric: canonicalizeEnrichedLyric,
    validateLyric: validateEnrichedLyric,
  })

  // Comparing tags by codepoint sorted every capitalized tag ahead of every lowercase one.
  it('compares language tags without case', () => {
    const languages = [makeEnrichedLanguageUsage({ tag: 'Zh', lineCount: 1 }), makeEnrichedLanguageUsage({ tag: 'ja', lineCount: 1 })]
    deepStrictEqual(
      orderEnrichedLanguageUsages(languages).map((usage) => usage.tag),
      ['ja', 'Zh'],
    )
  })

  it('orders language usages by descending line count', () => {
    const languages = [makeEnrichedLanguageUsage({ tag: 'en', lineCount: 1 }), makeEnrichedLanguageUsage({ tag: 'ja', lineCount: 3 })]
    deepStrictEqual(
      orderEnrichedLanguageUsages(languages).map((usage) => usage.tag),
      ['ja', 'en'],
    )
  })
})
