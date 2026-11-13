import { deepStrictEqual } from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EnrichedLyricStatus,
  TimingLevel,
  isLanguageTag,
  makeDocumentLyric,
  makeEnrichedLyric,
  makeMeta,
  makeText,
  validateDocumentLyric,
  validateEnrichedLyric,
} from '@root/index'

describe('language tag syntax', () => {
  it('accepts ordinary tags without requiring registered or unique subtags', () => {
    const tags = [
      'en',
      'EN',
      'und',
      'qqq',
      'abcd',
      'abcde',
      'abcdefgh',
      'en-US',
      'es-419',
      'zh-Hans',
      'zh-Hans-CN',
      'zh-cmn-Hans-CN',
      'en-aaa-bbb-ccc-Latn-US',
      'de-CH-1901',
      'sl-rozaj-biske-1994',
      'en-1abc',
      'en-variant1-variant2',
      'en-u-ca-gregory',
      'EN-u-CA-GREGORY',
      'en-0-ab',
      'en-a-foo-b-bar',
      'en-a-Latn-US',
      'en-1901-1901',
      'en-a-foo-a-bar',
      'en-u-ca-gregory-ca-buddhist',
    ]
    for (const tag of tags) {
      deepStrictEqual(isLanguageTag(tag), true, tag)
    }
  })

  it('accepts private use and tags longer than 35 characters', () => {
    const tags = [
      'x-acme',
      'X-Acme',
      'x-a',
      'x-1',
      'x-a-a',
      'x-12345678',
      'en-x-acme',
      'en-x-US-GB',
      'en-x-a-a',
      'en-x-x',
      'en-a-foo-x-a',
      'zh-Hans-CN-x-demo',
      'en-x-12345678-12345678-12345678-12345678',
    ]
    for (const tag of tags) {
      deepStrictEqual(isLanguageTag(tag), true, tag)
    }
  })

  it('accepts the grandfathered tags case-insensitively', () => {
    const tags = [
      'en-GB-oed',
      'i-ami',
      'i-bnn',
      'i-default',
      'i-enochian',
      'i-hak',
      'i-klingon',
      'i-lux',
      'i-mingo',
      'i-navajo',
      'i-pwn',
      'i-tao',
      'i-tay',
      'i-tsu',
      'sgn-BE-FR',
      'sgn-BE-NL',
      'sgn-CH-DE',
      'art-lojban',
      'cel-gaulish',
      'no-bok',
      'no-nyn',
      'zh-guoyu',
      'zh-hakka',
      'zh-min',
      'zh-min-nan',
      'zh-xiang',
    ]
    for (const tag of tags) {
      deepStrictEqual(isLanguageTag(tag), true, tag)
      deepStrictEqual(isLanguageTag(tag.toUpperCase()), true, tag)
    }
  })

  it('rejects malformed structures and original non-ASCII characters', () => {
    const tags = [
      '',
      'a',
      'abcdefghi',
      '123',
      'en_US',
      ' en',
      'en ',
      'en\n',
      'en\t',
      'en\r',
      'en\u0000',
      '\u212Aa',
      'en-\u0130N',
      'en-\uFF35\uFF33',
      '-en',
      'en-',
      'en--US',
      'en-abcdefghi',
      'x',
      'x-',
      'x--a',
      'x-123456789',
      'i',
      'i-test',
      'i-klingon-extra',
      'en-GB-oed-x-extra',
      'sgn-BE-FR-x-extra',
      'en-US-GB',
      'en-Latn-Hans',
      'en-US-Latn',
      'en-1901-US',
      'abcd-efg',
      'en-aaa-bbb-ccc-ddd',
      'en-12',
      'en-1ab',
      'en-a',
      'en-a-b-foo',
      'en-a-x-test',
      'en-a-1',
      'en-a-123456789',
      'en-a-foo-b',
      'en-x',
      'en-x-',
    ]
    for (const tag of tags) {
      deepStrictEqual(isLanguageTag(tag), false, JSON.stringify(tag))
    }
  })

  it('applies the same syntax to nested tags in both lyric layers', () => {
    for (const [language, accepted] of [
      ['x-acme', true],
      ['i-klingon', true],
      ['en-a', false],
      ['en-US-GB', false],
    ] as const) {
      const meta = makeMeta({ titles: [makeText({ language, text: 'Song' })] })
      const document = makeDocumentLyric({ timing: TimingLevel.NONE, meta })
      const enriched = makeEnrichedLyric({ status: EnrichedLyricStatus.VALID, timing: TimingLevel.NONE, meta })
      for (const diagnostics of [validateDocumentLyric(document), validateEnrichedLyric(enriched)]) {
        deepStrictEqual(diagnostics, accepted ? [] : [{ path: 'meta.titles[0].language', code: 'language.tag.malformed' }], language)
      }
    }
  })
})
