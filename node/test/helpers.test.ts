import { runtime } from '@root/index'

import { describe, it } from 'node:test'
import { deepStrictEqual } from 'node:assert/strict'

describe('derive line languages', () => {
  // Returning the line's own array let a caller mutate the line through the result.
  it('returns a copy, lowercased and without repeats', () => {
    const line = runtime.makeLineNormal({ languages: ['JA-JP', 'ja-jp', 'EN'] })
    const languages = runtime.deriveLineLanguages(line)

    deepStrictEqual(languages, ['ja-jp', 'en'])
    languages.push('de')
    deepStrictEqual(line.languages, ['JA-JP', 'ja-jp', 'EN'])
  })

  it('falls back to the tags of the words', () => {
    const line = runtime.makeLineNormal({
      content: runtime.makeLineContentWords([
        runtime.makeWordNormal({ text: 'hi', language: 'EN' }),
        runtime.makeWordSpace({ text: ' ' }),
        runtime.makeWordNormal({ text: 'there', language: 'en' }),
      ]),
    })
    deepStrictEqual(runtime.deriveLineLanguages(line), ['en'])
  })
})

describe('resolve line agents', () => {
  // Resolving has to agree with what validate reports about a duplicate and an empty id, or the two tell different stories.
  it('keeps the first agent claiming an id', () => {
    const agents = [
      runtime.makeAgent({ id: 'a', type: runtime.AgentType.PERSON, names: [runtime.makeText({ text: 'first' })] }),
      runtime.makeAgent({ id: 'a', type: runtime.AgentType.PERSON, names: [runtime.makeText({ text: 'second' })] }),
    ]
    const resolved = runtime.resolveLineAgents({ agents: ['a'] }, agents)
    deepStrictEqual(
      resolved.map((agent) => agent.names[0]?.text),
      ['first'],
    )
  })

  it('resolves neither an empty id nor one naming no agent', () => {
    const agents = [runtime.makeAgent({ id: '', type: runtime.AgentType.PERSON }), runtime.makeAgent({ id: 'a', type: runtime.AgentType.PERSON })]
    deepStrictEqual(runtime.resolveLineAgents({ agents: ['', 'ghost'] }, agents), [])
  })
})
