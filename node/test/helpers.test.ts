import { describe, it } from 'node:test'
import { deepStrictEqual } from 'node:assert/strict'

import { enriched, document } from '@root/index'

describe('derive line languages', () => {
  // Returning the line's own array let a caller mutate the line through the result.
  it('returns a copy, lowercased and without repeats', () => {
    const line = enriched.makeLineNormal({ languages: ['JA-JP', 'ja-jp', 'EN'] })
    const languages = enriched.deriveLineLanguages(line)

    deepStrictEqual(languages, ['ja-jp', 'en'])
    languages.push('de')
    deepStrictEqual(line.languages, ['JA-JP', 'ja-jp', 'EN'])
  })

  it('falls back to the tags of the words', () => {
    const line = enriched.makeLineNormal({
      content: enriched.makeLineContentWords([
        enriched.makeWordNormal({ text: 'hi', language: 'EN' }),
        enriched.makeWordSpace({ text: ' ' }),
        enriched.makeWordNormal({ text: 'there', language: 'en' }),
      ]),
    })
    deepStrictEqual(enriched.deriveLineLanguages(line), ['en'])
  })
})

describe('derive line romans', () => {
  it('preserves schemes and spacing for document annotations', () => {
    const first = document.makeWordAnnotation({
      romans: [
        document.makeWordAnnotationRoman({ language: 'JA-Latn', scheme: 'HEPBURN', tokens: [document.makeWordAnnotationToken({ text: 'shi' })] }),
        document.makeWordAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', tokens: [document.makeWordAnnotationToken({ text: 'si' })] }),
        document.makeWordAnnotationRoman({ language: 'ja-latn', tokens: [document.makeWordAnnotationToken({ text: 'default' })] }),
      ],
    })
    const last = document.makeWordAnnotation({
      romans: [
        document.makeWordAnnotationRoman({ language: 'ja-latn', scheme: 'KUNREI', tokens: [document.makeWordAnnotationToken({ text: 'ti' })] }),
        document.makeWordAnnotationRoman({ language: 'JA-LATN', scheme: 'hepburn', tokens: [document.makeWordAnnotationToken({ text: 'chi' })] }),
        document.makeWordAnnotationRoman({ language: 'ja-latn', scheme: '', tokens: [document.makeWordAnnotationToken({ text: 'text' })] }),
      ],
    })
    const words = [
      document.makeWordSpace({ text: ' ' }),
      document.makeWordNormal({ text: 'x', annotation: first }),
      document.makeWordSpace({ text: '  ' }),
      document.makeWordNormal({ text: 'omitted' }),
      document.makeWordNormal({ text: 'y', annotation: last }),
      document.makeWordSpace({ text: ' ' }),
    ]
    deepStrictEqual(document.deriveLineRomans(document.makeLineContentWords(words)), [
      document.makeLineAnnotationRoman({ language: 'ja-latn', scheme: 'hepburn', text: 'shi chi' }),
      document.makeLineAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', text: 'si ti' }),
      document.makeLineAnnotationRoman({ language: 'ja-latn', text: 'default text' }),
    ])
    deepStrictEqual(first.romans[0]?.scheme, 'HEPBURN')
  })

  it('preserves schemes and spacing for enriched annotations', () => {
    const first = enriched.makeWordAnnotation({
      romans: [
        enriched.makeWordAnnotationRoman({ language: 'JA-Latn', scheme: 'HEPBURN', tokens: [enriched.makeWordAnnotationToken({ text: 'shi' })] }),
        enriched.makeWordAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', tokens: [enriched.makeWordAnnotationToken({ text: 'si' })] }),
        enriched.makeWordAnnotationRoman({ language: 'ja-latn', tokens: [enriched.makeWordAnnotationToken({ text: 'default' })] }),
      ],
    })
    const last = enriched.makeWordAnnotation({
      romans: [
        enriched.makeWordAnnotationRoman({ language: 'ja-latn', scheme: 'KUNREI', tokens: [enriched.makeWordAnnotationToken({ text: 'ti' })] }),
        enriched.makeWordAnnotationRoman({ language: 'JA-LATN', scheme: 'hepburn', tokens: [enriched.makeWordAnnotationToken({ text: 'chi' })] }),
        enriched.makeWordAnnotationRoman({ language: 'ja-latn', scheme: '', tokens: [enriched.makeWordAnnotationToken({ text: 'text' })] }),
      ],
    })
    const words = [
      enriched.makeWordSpace({ text: ' ' }),
      enriched.makeWordNormal({ text: 'x', annotation: first }),
      enriched.makeWordSpace({ text: '  ' }),
      enriched.makeWordNormal({ text: 'omitted' }),
      enriched.makeWordNormal({ text: 'y', annotation: last }),
      enriched.makeWordSpace({ text: ' ' }),
    ]
    deepStrictEqual(enriched.deriveLineRomans(enriched.makeLineContentWords(words)), [
      enriched.makeLineAnnotationRoman({ language: 'ja-latn', scheme: 'hepburn', text: 'shi chi' }),
      enriched.makeLineAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', text: 'si ti' }),
      enriched.makeLineAnnotationRoman({ language: 'ja-latn', text: 'default text' }),
    ])
    deepStrictEqual(first.romans[0]?.scheme, 'HEPBURN')
  })
})

describe('resolve line agents', () => {
  // Resolving has to agree with what validate reports about a duplicate and an empty id, or the two tell different stories.
  it('keeps the first agent claiming an id', () => {
    const agents = [
      enriched.makeAgent({ id: 'a', type: enriched.AgentType.PERSON, names: [enriched.makeText({ text: 'first' })] }),
      enriched.makeAgent({ id: 'a', type: enriched.AgentType.PERSON, names: [enriched.makeText({ text: 'second' })] }),
    ]
    const resolved = enriched.resolveLineAgents({ agents: ['a'] }, agents)
    deepStrictEqual(
      resolved.map((agent) => agent.names[0]?.text),
      ['first'],
    )
  })

  it('resolves neither an empty id nor one naming no agent', () => {
    const agents = [enriched.makeAgent({ id: '', type: enriched.AgentType.PERSON }), enriched.makeAgent({ id: 'a', type: enriched.AgentType.PERSON })]
    deepStrictEqual(enriched.resolveLineAgents({ agents: ['', 'ghost'] }, agents), [])
  })
})
