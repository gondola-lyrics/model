import { deepStrictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EnrichedLyricStatus,
  TimingLevel,
  makeEnrichedLanguageUsage,
  makeEnrichedLineNormal,
  makeEnrichedLyric,
  makeTimeRange,
  orderEnrichedLanguageUsages,
  orderEnrichedLyric,
} from '@root/index'

describe('order', () => {
  // A line with no range used to sort first, which told the consumer it starts at zero.
  it('puts lines with no range last, in the order they came', () => {
    const lyric = makeEnrichedLyric({
      format: 'lrc',
      timing: TimingLevel.LINE,
      status: EnrichedLyricStatus.VALID,
      lines: [
        makeEnrichedLineNormal({ id: 'second', time: makeTimeRange({ start: 2000 }) }),
        makeEnrichedLineNormal({ id: 'untimed-first' }),
        makeEnrichedLineNormal({ id: 'first', time: makeTimeRange({ start: 1000 }) }),
        makeEnrichedLineNormal({ id: 'untimed-second' }),
      ],
    })
    deepStrictEqual(
      orderEnrichedLyric(lyric).lines.map((line) => line.id),
      ['first', 'second', 'untimed-first', 'untimed-second'],
    )
  })

  // Comparing tags by codepoint sorted every capitalized tag ahead of every lowercase one.
  it('compares language tags without case', () => {
    const languages = [makeEnrichedLanguageUsage({ tag: 'Zh', count: 1 }), makeEnrichedLanguageUsage({ tag: 'ja', count: 1 })]
    deepStrictEqual(
      orderEnrichedLanguageUsages(languages).map((usage) => usage.tag),
      ['ja', 'Zh'],
    )
  })

  it('orders language usages by descending count', () => {
    const languages = [makeEnrichedLanguageUsage({ tag: 'en', count: 1 }), makeEnrichedLanguageUsage({ tag: 'ja', count: 3 })]
    deepStrictEqual(
      orderEnrichedLanguageUsages(languages).map((usage) => usage.tag),
      ['ja', 'en'],
    )
  })
})
