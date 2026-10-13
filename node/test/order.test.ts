import { runtime } from '@root/index'

import { describe, it } from 'node:test'
import { deepStrictEqual } from 'node:assert/strict'

describe('order', () => {
  // A line with no range used to sort first, which told the consumer it starts at zero.
  it('puts lines with no range last, in the order they came', () => {
    const lyric = runtime.makeLyric({
      format: 'lrc',
      timing: runtime.Timing.LINE,
      status: runtime.LyricStatus.VALID,
      lines: [
        runtime.makeLineNormal({ id: 'second', time: runtime.makeTimeRange({ start: 2000 }) }),
        runtime.makeLineNormal({ id: 'untimed-first' }),
        runtime.makeLineNormal({ id: 'first', time: runtime.makeTimeRange({ start: 1000 }) }),
        runtime.makeLineNormal({ id: 'untimed-second' }),
      ],
    })
    deepStrictEqual(
      runtime.orderLyric(lyric).lines.map((line) => line.id),
      ['first', 'second', 'untimed-first', 'untimed-second'],
    )
  })

  // Comparing tags by codepoint sorted every capitalized tag ahead of every lowercase one.
  it('compares language tags without case', () => {
    const languages = [runtime.makeLanguageUsage({ tag: 'Zh', count: 1 }), runtime.makeLanguageUsage({ tag: 'ja', count: 1 })]
    deepStrictEqual(
      runtime.orderLanguageUsages(languages).map((usage) => usage.tag),
      ['ja', 'Zh'],
    )
  })

  it('orders language usages by descending count', () => {
    const languages = [runtime.makeLanguageUsage({ tag: 'en', count: 1 }), runtime.makeLanguageUsage({ tag: 'ja', count: 3 })]
    deepStrictEqual(
      runtime.orderLanguageUsages(languages).map((usage) => usage.tag),
      ['ja', 'en'],
    )
  })
})
