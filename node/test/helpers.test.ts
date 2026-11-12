import { deepStrictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  AgentType,
  deriveDocumentLineRomans,
  deriveEnrichedLineLanguages,
  deriveEnrichedLineRomans,
  makeAgent,
  makeDocumentLineAnnotationRoman,
  makeDocumentLineContentWords,
  makeDocumentWordAnnotation,
  makeDocumentWordAnnotationRoman,
  makeDocumentWordAnnotationToken,
  makeDocumentWordNormal,
  makeDocumentWordSpace,
  makeEnrichedLineAnnotationRoman,
  makeEnrichedLineContentWords,
  makeEnrichedLineNormal,
  makeEnrichedWordAnnotation,
  makeEnrichedWordAnnotationRoman,
  makeEnrichedWordAnnotationToken,
  makeEnrichedWordNormal,
  makeEnrichedWordSpace,
  makeText,
  resolveLineAgents,
} from '@root/index'

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
        makeDocumentWordAnnotationRoman({ language: 'JA-Latn', scheme: 'HEPBURN', tokens: [makeDocumentWordAnnotationToken({ text: 'shi' })] }),
        makeDocumentWordAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', tokens: [makeDocumentWordAnnotationToken({ text: 'si' })] }),
        makeDocumentWordAnnotationRoman({ language: 'ja-latn', tokens: [makeDocumentWordAnnotationToken({ text: 'default' })] }),
      ],
    })
    const last = makeDocumentWordAnnotation({
      romans: [
        makeDocumentWordAnnotationRoman({ language: 'ja-latn', scheme: 'KUNREI', tokens: [makeDocumentWordAnnotationToken({ text: 'ti' })] }),
        makeDocumentWordAnnotationRoman({ language: 'JA-LATN', scheme: 'hepburn', tokens: [makeDocumentWordAnnotationToken({ text: 'chi' })] }),
        makeDocumentWordAnnotationRoman({ language: 'ja-latn', scheme: '', tokens: [makeDocumentWordAnnotationToken({ text: 'text' })] }),
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
      makeDocumentLineAnnotationRoman({ language: 'ja-latn', scheme: 'hepburn', text: 'shi chi' }),
      makeDocumentLineAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', text: 'si ti' }),
      makeDocumentLineAnnotationRoman({ language: 'ja-latn', text: 'default text' }),
    ])
    deepStrictEqual(first.romans[0]?.scheme, 'HEPBURN')
  })

  it('preserves schemes and spacing for enriched annotations', () => {
    const first = makeEnrichedWordAnnotation({
      romans: [
        makeEnrichedWordAnnotationRoman({ language: 'JA-Latn', scheme: 'HEPBURN', tokens: [makeEnrichedWordAnnotationToken({ text: 'shi' })] }),
        makeEnrichedWordAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', tokens: [makeEnrichedWordAnnotationToken({ text: 'si' })] }),
        makeEnrichedWordAnnotationRoman({ language: 'ja-latn', tokens: [makeEnrichedWordAnnotationToken({ text: 'default' })] }),
      ],
    })
    const last = makeEnrichedWordAnnotation({
      romans: [
        makeEnrichedWordAnnotationRoman({ language: 'ja-latn', scheme: 'KUNREI', tokens: [makeEnrichedWordAnnotationToken({ text: 'ti' })] }),
        makeEnrichedWordAnnotationRoman({ language: 'JA-LATN', scheme: 'hepburn', tokens: [makeEnrichedWordAnnotationToken({ text: 'chi' })] }),
        makeEnrichedWordAnnotationRoman({ language: 'ja-latn', scheme: '', tokens: [makeEnrichedWordAnnotationToken({ text: 'text' })] }),
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
      makeEnrichedLineAnnotationRoman({ language: 'ja-latn', scheme: 'hepburn', text: 'shi chi' }),
      makeEnrichedLineAnnotationRoman({ language: 'ja-latn', scheme: 'kunrei', text: 'si ti' }),
      makeEnrichedLineAnnotationRoman({ language: 'ja-latn', text: 'default text' }),
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
    const resolved = resolveLineAgents({ agents: ['a'] }, agents)
    deepStrictEqual(
      resolved.map((agent) => agent.names[0]?.text),
      ['first'],
    )
  })

  it('resolves neither an empty id nor one naming no agent', () => {
    const agents = [makeAgent({ id: '', type: AgentType.PERSON }), makeAgent({ id: 'a', type: AgentType.PERSON })]
    deepStrictEqual(resolveLineAgents({ agents: ['', 'ghost'] }, agents), [])
  })
})
