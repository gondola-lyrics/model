import { deepStrictEqual, strictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  AgentType,
  deriveDocumentLineRomans,
  deriveEnrichedLineLanguages,
  deriveEnrichedLineRomans,
  makeAgent,
  makeDocumentLineAnnotationRoman,
  makeDocumentLineAnnotationRomanContentText,
  makeDocumentLineContentWords,
  makeDocumentWordAnnotation,
  makeDocumentWordAnnotationRoman,
  makeDocumentWordAnnotationRuby,
  makeDocumentWordNormal,
  makeDocumentWordSpace,
  makeEnrichedLineAnnotationRoman,
  makeEnrichedLineAnnotationRomanContentText,
  makeEnrichedLineContentWords,
  makeEnrichedLineNormal,
  makeEnrichedWordAnnotation,
  makeEnrichedWordAnnotationRoman,
  makeEnrichedWordAnnotationRuby,
  makeTextToken,
  makeEnrichedWordNormal,
  makeEnrichedWordSpace,
  makeText,
  makeTimeRange,
  pickItemByLanguage,
  pickItemByScheme,
  resolveLineAgents,
} from '@root/index'

describe('pick by scheme', () => {
  it('selects case-insensitive schemes and keeps the original roman or ruby item in both layers', () => {
    const time = makeTimeRange({ start: 1000, end: 2000 })
    const tokens = [makeTextToken({ text: 'shi', time, extra: { source: 'kept' } })]
    const language = 'ja-Latn'
    const factories = [
      (scheme: string) => makeDocumentLineAnnotationRoman({ language, scheme, time, content: makeDocumentLineAnnotationRomanContentText('shi') }),
      (scheme: string) => makeEnrichedLineAnnotationRoman({ language, scheme, time, content: makeEnrichedLineAnnotationRomanContentText('shi') }),
      (scheme: string) => makeDocumentWordAnnotationRoman({ language, scheme, time, tokens }),
      (scheme: string) => makeEnrichedWordAnnotationRoman({ language, scheme, time, tokens }),
      (scheme: string) => makeDocumentWordAnnotationRuby({ language, scheme, time, tokens }),
      (scheme: string) => makeEnrichedWordAnnotationRuby({ language, scheme, time, tokens }),
    ]
    for (const make of factories) {
      const items = [make('kunrei'), make('HePbUrN'), make('hepburn')] as const
      const preference = { scheme: 'HEPBURN', languages: ['ja-Latn'] as const }
      const snapshot = structuredClone({ items, preference })
      strictEqual(pickItemByScheme(items, preference), items[1])
      strictEqual(pickItemByScheme(items, { scheme: 'hepburn', languages: 'JA-latn' }), items[1])
      deepStrictEqual({ items, preference }, snapshot)
    }
  })

  it('distinguishes unrestricted and empty schemes while applying ordered language preferences', () => {
    const other = makeDocumentWordAnnotationRoman({ language: 'ja-Latn', scheme: 'kunrei' })
    const unspecified = makeDocumentWordAnnotationRoman({ language: 'ja-Latn' })
    const empty = makeDocumentWordAnnotationRoman({ language: 'ja-Latn', scheme: '' })
    const japanese = makeDocumentWordAnnotationRoman({ language: 'ja-Latn', scheme: 'hepburn' })
    const english = makeDocumentWordAnnotationRoman({ language: 'en', scheme: 'hepburn' })
    const defaultItem = makeDocumentWordAnnotationRoman({ scheme: 'hepburn' })
    const items = [other, unspecified, empty, japanese, english, defaultItem] as const

    strictEqual(pickItemByScheme(items, { languages: 'ja-Latn' }), other)
    strictEqual(pickItemByScheme(items, { scheme: undefined, languages: 'ja-Latn' }), other)
    strictEqual(pickItemByScheme(items, { scheme: '', languages: 'ja-Latn' }), unspecified)
    strictEqual(pickItemByScheme([empty, unspecified], { scheme: '', languages: 'ja-Latn' }), empty)
    strictEqual(pickItemByScheme(items, { scheme: 'hepburn', languages: ['zh', 'en'] }), english)
    strictEqual(pickItemByScheme(items, { scheme: 'hepburn', languages: ['ja', 'en'] }), japanese)
    strictEqual(pickItemByScheme(items, { scheme: 'hepburn', languages: ['', 'en'] }), english)
    strictEqual(pickItemByScheme(items, { scheme: 'hepburn' }), defaultItem)
    strictEqual(pickItemByScheme(items), defaultItem)
  })

  it('keeps default and first-item fallback inside the exact scheme filter', () => {
    const other = makeDocumentWordAnnotationRoman({ language: 'fr', scheme: 'kunrei' })
    const selected = makeDocumentWordAnnotationRoman({ language: 'en', scheme: 'hepburn' })
    const defaultItem = makeDocumentWordAnnotationRoman({ scheme: 'hepburn' })
    const items = [other, selected] as const

    strictEqual(pickItemByScheme(items, { scheme: 'hepburn', languages: 'fr' }), undefined)
    strictEqual(pickItemByScheme(items, { scheme: 'hepburn', languages: 'fr', fallback: true }), selected)
    strictEqual(pickItemByScheme([...items, defaultItem], { scheme: 'hepburn', languages: 'fr', fallback: true }), defaultItem)
    for (const scheme of ['missing', 'hepb', ' hepburn ', '']) {
      strictEqual(pickItemByScheme(items, { scheme, languages: 'en', fallback: true }), undefined)
    }
    strictEqual(pickItemByScheme(items, { scheme: 'hepburn' }), undefined)
    strictEqual(pickItemByScheme(items, { scheme: 'hepburn', fallback: true }), selected)
    strictEqual(pickItemByScheme([], { scheme: 'hepburn', fallback: true }), undefined)
  })
})

describe('pick by language', () => {
  it('tries ordered preferences before falling back to an untagged entry', () => {
    const defaultItem = makeText({ text: 'Default' })
    const english = makeText({ language: 'en', text: 'English' })
    const chinese = makeText({ language: 'zh-TW', text: 'Chinese' })
    const items = [defaultItem, english] as const
    const preferences = ['zh', 'en'] as const
    const snapshot = structuredClone({ items, preferences })

    strictEqual(pickItemByLanguage(items, preferences), english)
    strictEqual(pickItemByLanguage(items, ['', 'zh', 'EN']), english)
    strictEqual(pickItemByLanguage([...items, chinese], ['zh', 'en']), chinese)
    strictEqual(pickItemByLanguage([...items, chinese], ['en', 'zh']), english)
    deepStrictEqual({ items, preferences }, snapshot)
  })

  it('preserves single-language ranking, boundaries, and source order on ties', () => {
    const english = makeText({ language: 'en', text: 'English' })
    const extended = makeText({ language: 'en-US-x-demo', text: 'Extended' })
    const regional = makeText({ language: 'en-US', text: 'Regional' })
    const tied = makeText({ language: 'EN-us', text: 'Tied' })
    const items = [english, extended, regional, tied] as const
    const cases = [
      ['en', english],
      ['EN-us', regional],
      ['en-US-x-demo', extended],
      ['en-US-x-other', regional],
    ] as const
    for (const [wanted, expected] of cases) {
      strictEqual(pickItemByLanguage(items, wanted), expected)
      strictEqual(pickItemByLanguage(items, [wanted]), expected)
    }
    strictEqual(pickItemByLanguage([makeText({ language: 'jav', text: 'Other' })], ['ja']), undefined)
    strictEqual(pickItemByLanguage([makeText({ language: 'zh-CN', text: 'Other' })], ['zh-Hans']), undefined)
  })

  it('applies default and explicit first-item fallback after all preferences fail', () => {
    const english = makeText({ language: 'en', text: 'English' })
    const emptyLanguage = makeText({ language: '', text: 'Default' })
    const untagged = makeText({ text: 'Untagged' })
    const items = [english, emptyLanguage, untagged] as const
    for (const wanted of [undefined, '', [], [''], ['fr', 'de']] as const) {
      strictEqual(pickItemByLanguage(items, wanted), emptyLanguage)
      strictEqual(pickItemByLanguage(items, wanted, true), emptyLanguage)
    }
    strictEqual(pickItemByLanguage([english], ['fr', 'de']), undefined)
    strictEqual(pickItemByLanguage([english], ['fr', 'de'], true), english)
    strictEqual(pickItemByLanguage([english], undefined, true), english)
    strictEqual(pickItemByLanguage([english], 'fr', true), english)
    strictEqual(pickItemByLanguage([], ['en'], true), undefined)
  })
})

describe('derive line languages', () => {
  // Returning the line's own array let a caller mutate the line through the result.
  it('returns a copy, lowercased and without repeats', () => {
    const line = makeEnrichedLineNormal({ languages: ['JA-JP', 'ja-jp', 'EN'] })
    const languages = deriveEnrichedLineLanguages(line)

    deepStrictEqual(languages, ['ja-jp', 'en'])
    languages.push('de')
    deepStrictEqual(line.languages, ['JA-JP', 'ja-jp', 'EN'])
  })

  it('falls back to the tags of the words', () => {
    const line = makeEnrichedLineNormal({
      content: makeEnrichedLineContentWords([
        makeEnrichedWordNormal({ text: 'hi', language: 'EN' }),
        makeEnrichedWordSpace({ text: ' ' }),
        makeEnrichedWordNormal({ text: 'there', language: 'en' }),
      ]),
    })
    deepStrictEqual(deriveEnrichedLineLanguages(line), ['en'])
  })
})

describe('derive line romans', () => {
  it('preserves schemes and spacing for document annotations', () => {
    const first = makeDocumentWordAnnotation({
      romans: [
        makeDocumentWordAnnotationRoman({ language: 'JA-Latn', scheme: 'HEPBURN', tokens: [makeTextToken({ text: 'shi' })] }),
        makeDocumentWordAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', tokens: [makeTextToken({ text: 'si' })] }),
        makeDocumentWordAnnotationRoman({ language: 'ja-latn', tokens: [makeTextToken({ text: 'default' })] }),
      ],
    })
    const last = makeDocumentWordAnnotation({
      romans: [
        makeDocumentWordAnnotationRoman({ language: 'ja-latn', scheme: 'KUNREI', tokens: [makeTextToken({ text: 'ti' })] }),
        makeDocumentWordAnnotationRoman({ language: 'JA-LATN', scheme: 'hepburn', tokens: [makeTextToken({ text: 'chi' })] }),
        makeDocumentWordAnnotationRoman({ language: 'ja-latn', scheme: '', tokens: [makeTextToken({ text: 'text' })] }),
      ],
    })
    const words = [
      makeDocumentWordSpace({ text: ' ' }),
      makeDocumentWordNormal({ text: 'x', annotation: first }),
      makeDocumentWordSpace({ text: '  ' }),
      makeDocumentWordNormal({ text: 'omitted' }),
      makeDocumentWordNormal({ text: 'y', annotation: last }),
      makeDocumentWordSpace({ text: ' ' }),
    ]
    deepStrictEqual(deriveDocumentLineRomans(makeDocumentLineContentWords(words)), [
      makeDocumentLineAnnotationRoman({ language: 'ja-latn', scheme: 'hepburn', content: makeDocumentLineAnnotationRomanContentText('shi chi') }),
      makeDocumentLineAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', content: makeDocumentLineAnnotationRomanContentText('si ti') }),
      makeDocumentLineAnnotationRoman({ language: 'ja-latn', content: makeDocumentLineAnnotationRomanContentText('default text') }),
    ])
    deepStrictEqual(first.romans[0]?.scheme, 'HEPBURN')
  })

  it('preserves schemes and spacing for enriched annotations', () => {
    const first = makeEnrichedWordAnnotation({
      romans: [
        makeEnrichedWordAnnotationRoman({ language: 'JA-Latn', scheme: 'HEPBURN', tokens: [makeTextToken({ text: 'shi' })] }),
        makeEnrichedWordAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', tokens: [makeTextToken({ text: 'si' })] }),
        makeEnrichedWordAnnotationRoman({ language: 'ja-latn', tokens: [makeTextToken({ text: 'default' })] }),
      ],
    })
    const last = makeEnrichedWordAnnotation({
      romans: [
        makeEnrichedWordAnnotationRoman({ language: 'ja-latn', scheme: 'KUNREI', tokens: [makeTextToken({ text: 'ti' })] }),
        makeEnrichedWordAnnotationRoman({ language: 'JA-LATN', scheme: 'hepburn', tokens: [makeTextToken({ text: 'chi' })] }),
        makeEnrichedWordAnnotationRoman({ language: 'ja-latn', scheme: '', tokens: [makeTextToken({ text: 'text' })] }),
      ],
    })
    const words = [
      makeEnrichedWordSpace({ text: ' ' }),
      makeEnrichedWordNormal({ text: 'x', annotation: first }),
      makeEnrichedWordSpace({ text: '  ' }),
      makeEnrichedWordNormal({ text: 'omitted' }),
      makeEnrichedWordNormal({ text: 'y', annotation: last }),
      makeEnrichedWordSpace({ text: ' ' }),
    ]
    deepStrictEqual(deriveEnrichedLineRomans(makeEnrichedLineContentWords(words)), [
      makeEnrichedLineAnnotationRoman({ language: 'ja-latn', scheme: 'hepburn', content: makeEnrichedLineAnnotationRomanContentText('shi chi') }),
      makeEnrichedLineAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', content: makeEnrichedLineAnnotationRomanContentText('si ti') }),
      makeEnrichedLineAnnotationRoman({ language: 'ja-latn', content: makeEnrichedLineAnnotationRomanContentText('default text') }),
    ])
    deepStrictEqual(first.romans[0]?.scheme, 'HEPBURN')
  })
})

describe('resolve line agents', () => {
  // Resolving has to agree with what validate reports about a duplicate and an empty id, or the two tell different stories.
  it('keeps the first agent claiming an id', () => {
    const agents = [
      makeAgent({ id: 'a', type: AgentType.PERSON, names: [makeText({ text: 'first' })] }),
      makeAgent({ id: 'a', type: AgentType.PERSON, names: [makeText({ text: 'second' })] }),
    ]
    const resolved = resolveLineAgents({ agentIds: ['a'] }, agents)
    deepStrictEqual(
      resolved.map((agent) => agent.names[0]?.text),
      ['first'],
    )
  })

  it('resolves neither an empty id nor one naming no agent', () => {
    const agents = [makeAgent({ id: '', type: AgentType.PERSON }), makeAgent({ id: 'a', type: AgentType.PERSON })]
    deepStrictEqual(resolveLineAgents({ agentIds: ['', 'ghost'] }, agents), [])
  })
})
