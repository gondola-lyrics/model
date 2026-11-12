import type { DocumentLineContent, DocumentLyric, EnrichedLyric } from '@root/index'

import { create, createFileRegistry, fromBinary, toBinary } from '@bufbuild/protobuf'
import { FileDescriptorSetSchema } from '@bufbuild/protobuf/wkt'
import { deepStrictEqual, ok, throws } from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { describe, it } from 'node:test'

import {
  decodeDocumentLineContent,
  decodeEnrichedWordEmphasis,
  encodeDocumentLineContent,
  encodeEnrichedWordEmphasis,
} from '@root/generated/codec.gen'
import { createDocumentLineContent, createEnrichedWordEmphasis } from '@root/generated/detail.gen'
import {
  AgentType,
  CreditRole,
  DocumentWordType,
  EnrichedLyricStatus,
  PartType,
  Timing,
  decodeDocumentLyric,
  decodeEnrichedLyric,
  encodeDocumentLyric,
  encodeEnrichedLyric,
  makeAgent,
  makeDocumentLineBackground,
  makeDocumentLineContentText,
  makeDocumentLineContentWords,
  makeDocumentLineNormal,
  makeDocumentLyric,
  makeDocumentWordNormal,
  makeDocumentWordSpace,
  makeEnrichedLanguageUsage,
  makeEnrichedLineAnnotation,
  makeEnrichedLineAnnotationRoman,
  makeEnrichedLineAnnotationTranslation,
  makeEnrichedLineBackground,
  makeEnrichedLineContentText,
  makeEnrichedLineContentWords,
  makeEnrichedLineInstrumental,
  makeEnrichedLineNormal,
  makeEnrichedLyric,
  makeEnrichedWordAnnotation,
  makeEnrichedWordAnnotationRoman,
  makeEnrichedWordAnnotationRuby,
  makeEnrichedWordAnnotationToken,
  makeEnrichedWordAnnotationTranslation,
  makeEnrichedWordEmphasis,
  makeEnrichedWordNormal,
  makeEnrichedWordSpace,
  makeMeta,
  makeMetaCredit,
  makeMetaReference,
  makePart,
  makeText,
  makeTimeRange,
  makeUnknownEntry,
} from '@root/index'
import { read, write } from '@root/utils/wire'

/**
 * The same bytes every language's tests decode, covering presence: an explicit zero end, an empty language, a false and a true emphasis, an undeclared word type and an empty text.
 */
const STANDARD_SAMPLE = '0a090801120210002201610a0d0801120208051a0022016130000a07086322016130011200'

// The official library reads the schema from the descriptors buf builds, so it needs no generated code of its own.
const registry = createFileRegistry(fromBinary(FileDescriptorSetSchema, execFileSync('buf', ['build', '../proto', '-o', '-'])))

const official = (name: string) => {
  const schema = registry.getMessage(name)
  if (schema === undefined) {
    throw new Error(`missing ${name}`)
  }
  return schema
}

const fromHex = (hex: string): Uint8Array => {
  return Uint8Array.from(Buffer.from(hex, 'hex'))
}

const annotation = () => {
  return makeEnrichedWordAnnotation({
    rubies: [
      makeEnrichedWordAnnotationRuby({ language: 'zh-latn', scheme: 'pinyin', tokens: [makeEnrichedWordAnnotationToken({ text: 'han' })] }),
      makeEnrichedWordAnnotationRuby({
        language: 'ja',
        time: makeTimeRange({}),
        tokens: [makeEnrichedWordAnnotationToken({ text: '\u3042' })],
      }),
    ],
    romans: [
      makeEnrichedWordAnnotationRoman({
        language: 'ja-latn',
        scheme: 'hepburn',
        tokens: [makeEnrichedWordAnnotationToken({ time: makeTimeRange({ start: 1, end: 0 }), text: 'a' })],
      }),
    ],
    translations: [makeEnrichedWordAnnotationTranslation({ language: '', text: '😀' })],
  })
}

const meta = () => {
  return makeMeta({
    unknowns: [makeUnknownEntry({ key: 'k', value: 'v' }), makeUnknownEntry({ key: 'k', value: '' })],
    offset: -1500,
    duration: 2 ** 32 - 1,
    language: 'EN',
    titles: [makeText({ text: 't' })],
    artists: [makeText({ language: '', text: 'a' })],
    albums: [makeText()],
    authors: [makeText({ text: 'b' })],
    isrcs: ['USRC17607839', ''],
    credits: [makeMetaCredit({ role: 99 as CreditRole, raw: '', names: [makeText({ text: 'c' })] })],
    references: [makeMetaReference({ platform: 'x', ids: ['1', '2'] })],
  })
}

const lineAnnotation = () => {
  return makeEnrichedLineAnnotation({
    romans: [makeEnrichedLineAnnotationRoman({ language: 'ja-latn', scheme: 'hepburn', text: 'r' })],
    translations: [makeEnrichedLineAnnotationTranslation({ language: 'zh', text: '译' })],
  })
}

const extra = () => {
  const entries: Record<string, string> = {
    b: '2',
    a: '',
    $typeName: 'kept',
    ['\u043a\u043b\u044e\u0447']: '\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435',
  }
  Object.defineProperty(entries, '__proto__', { value: 'kept', enumerable: true, writable: true, configurable: true })
  return entries
}

const enrichedLyric = (): EnrichedLyric => {
  return makeEnrichedLyric({
    format: 'ttml',
    profile: 'amll',
    status: EnrichedLyricStatus.VALID,
    timing: 99 as Timing,
    meta: meta(),
    extra: extra(),
    languages: [makeEnrichedLanguageUsage({ tag: 'en', count: 3 })],
    agents: [makeAgent({ id: 'a', type: -1 as AgentType, raw: 'x', names: [makeText({ text: 'n' })] })],
    lines: [
      makeEnrichedLineNormal({
        id: 'l',
        time: makeTimeRange({ start: 0, end: 0 }),
        part: makePart({ type: PartType.CHORUS, id: 'Chorus-A', raw: '' }),
        agents: ['a'],
        languages: ['en', ''],
        content: makeEnrichedLineContentWords([
          makeEnrichedWordNormal({
            text: 'x',
            language: '',
            time: makeTimeRange({ start: 5 }),
            annotation: annotation(),
            emphasis: makeEnrichedWordEmphasis(),
          }),
          makeEnrichedWordSpace({ text: ' ' }),
        ]),
        annotation: lineAnnotation(),
        backgrounds: [
          makeEnrichedLineBackground({
            id: 'b',
            time: makeTimeRange({ start: 1 }),
            agents: ['a'],
            languages: ['ja'],
            content: makeEnrichedLineContentText(''),
            annotation: makeEnrichedLineAnnotation(),
          }),
        ],
      }),
      makeEnrichedLineInstrumental(),
    ],
  })
}

const documentLyric = (): DocumentLyric => {
  return makeDocumentLyric({
    format: 'ttml',
    profile: 'itunes',
    timing: Timing.WORD,
    meta: meta(),
    extra: extra(),
    agents: [makeAgent({ id: 'a', type: AgentType.GROUP, names: [makeText({ text: 'n' })] })],
    lines: [
      makeDocumentLineNormal({
        id: 'l',
        time: makeTimeRange({ start: 0 }),
        part: makePart({ type: PartType.OTHER, id: 'Section-B', raw: 'x' }),
        agents: ['a'],
        languages: ['en'],
        content: makeDocumentLineContentWords([
          makeDocumentWordNormal({
            text: 'x',
            language: 'en',
            time: makeTimeRange({ start: 5, end: 6 }),
            annotation: annotation(),
            emphasis: false,
          }),
          makeDocumentWordNormal({ text: 'y', emphasis: true }),
          makeDocumentWordSpace({ text: ' ' }),
        ]),
        annotation: lineAnnotation(),
        backgrounds: [makeDocumentLineBackground({ content: makeDocumentLineContentText('bg') })],
      }),
    ],
  })
}

const cases = [
  { name: 'lyric.enriched.Lyric', encode: encodeEnrichedLyric, decode: decodeEnrichedLyric, build: enrichedLyric },
  { name: 'lyric.document.Lyric', encode: encodeDocumentLyric, decode: decodeDocumentLyric, build: documentLyric },
] as const

describe('protobuf', () => {
  it('preserves optional emphasis fields with the official codec', () => {
    const schema = official('lyric.enriched.WordEmphasis')
    const values = [undefined, false, true]
    for (const value of values) {
      for (const derived of values) {
        const emphasis = makeEnrichedWordEmphasis({ value, derived })
        const bytes = toBinary(schema, create(schema, emphasis))
        deepStrictEqual(write(encodeEnrichedWordEmphasis, emphasis), bytes)
        deepStrictEqual(read(createEnrichedWordEmphasis, decodeEnrichedWordEmphasis, bytes), emphasis)
      }
    }
  })

  for (const { name, encode, decode, build } of cases) {
    it(`writes the bytes the official library writes for ${name}`, () => {
      const schema = official(name)
      const value = build() as never
      deepStrictEqual(encode(value), toBinary(schema, create(schema, value)))
    })

    it(`reads what the official library writes for ${name}`, () => {
      const schema = official(name)
      const value = build() as never
      deepStrictEqual(decode(toBinary(schema, create(schema, value))), value)
    })
  }

  it('keeps presence in the standard sample', () => {
    const bytes = fromHex(STANDARD_SAMPLE)
    const expected: DocumentLineContent = {
      words: [
        { type: DocumentWordType.NORMAL, time: { start: 0, end: 0 }, text: 'a' },
        { type: DocumentWordType.NORMAL, time: { start: 5 }, language: '', text: 'a', emphasis: false },
        { type: 99 as DocumentWordType, text: 'a', emphasis: true },
      ],
      text: '',
    }
    const schema = official('lyric.document.LineContent')

    deepStrictEqual(read(createDocumentLineContent, decodeDocumentLineContent, bytes), expected)
    deepStrictEqual(write(encodeDocumentLineContent, expected), bytes)
    deepStrictEqual(toBinary(schema, create(schema, expected as never)), bytes)
  })

  // Expected results follow the official Go library.
  it('rejects malformed bytes', () => {
    const malformed = {
      'a tag with nothing behind it': '0a',
      'a length past the end': '0a05',
      'a length past the end of the nested range': '32020a7f',
      'field number 0': '00',
      'wire type 7': '0f',
      'a tag past 32 bits': '8880808010',
      'a varint past 64 bits': '08ffffffffffffffffff02',
      'malformed UTF-8': '0a01ff',
      'a stray end group': '0c',
      'a mismatched end group': 'a306ac06',
      'an unterminated group': 'a306',
      'groups nested past the limit': 'a306'.repeat(10002) + 'a406'.repeat(10002),
    }
    for (const [why, hex] of Object.entries(malformed)) {
      throws(() => decodeEnrichedLyric(fromHex(hex)), why)
    }
  })

  // The second column is what the first re-encodes to, so what was kept and what was dropped both show.
  it('follows the wire rules on bytes no encoder here would write', () => {
    const accepted = {
      'skips a known number with the wrong wire type': ['0801', ''],
      'skips a length-delimited field the schema does not define': ['a2060161', ''],
      'skips a group the schema does not define': ['a3060801a406', ''],
      'accepts groups nested up to the limit': ['a306'.repeat(10001) + 'a406'.repeat(10001), ''],
      'reads a tag padded past five bytes': ['8a80808080000161', '0a0161'],
      'lets a later scalar win': ['0a01610a0162', '0a0162'],
      'merges a repeated submessage': ['3202100232021807', '320410021807'],
      'reads a missing map value as empty': ['3a030a0161', '3a050a01611200'],
      'reads a missing map key as empty': ['3a03120161', '3a050a00120161'],
      'lets a later map entry win': ['3a060a0161120162' + '3a060a0161120163', '3a060a0161120163'],
      'keeps a negative enum': ['28ffffffffffffffffff01', '28ffffffffffffffffff01'],
      'reads an overlong zero as the default': ['2880808080808080808000', ''],
      'keeps the low 32 bits of a uint32': ['320618ffffffff7f', '320618ffffffff0f'],
      'keeps a leading BOM': ['0a03efbbbf', '0a03efbbbf'],
    }
    for (const [why, [input, output]] of Object.entries(accepted)) {
      deepStrictEqual(Buffer.from(encodeEnrichedLyric(decodeEnrichedLyric(fromHex(input!)))).toString('hex'), output, why)
    }
    deepStrictEqual(
      read(createDocumentLineContent, decodeDocumentLineContent, fromHex('0a03308001')).words[0]?.emphasis,
      true,
      'any set bit makes a bool true',
    )
  })

  it('rejects a number outside the field range', () => {
    const lyric = makeEnrichedLyric({
      format: '',
      status: EnrichedLyricStatus.VALID,
      lines: [makeEnrichedLineNormal({ time: makeTimeRange({ start: -1 }) })],
    })
    throws(() => encodeEnrichedLyric(lyric))
  })

  // Whatever decode accepts has to survive encoding unchanged, or a lyric read from foreign bytes could not be saved again.
  it('round trips whatever it accepts from mutated bytes', () => {
    let state = 0x2545f491
    const random = (bound: number): number => {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      return (state >>> 0) % bound
    }
    for (const { encode, decode, build } of cases) {
      const valid = encode(build() as never)
      for (let n = 0; n < 2000; n++) {
        const bytes = valid.slice()
        for (let k = random(3); k >= 0; k--) {
          bytes[random(bytes.length)] = random(256)
        }
        let decoded
        try {
          decoded = decode(bytes)
        } catch (error) {
          // Only the reader's own errors and the decoder's verdict on UTF-8 reject the bytes, so any other error is a crash.
          ok(
            error instanceof Error && (error.constructor === Error || (error as NodeJS.ErrnoException).code === 'ERR_ENCODING_INVALID_ENCODED_DATA'),
            String(error),
          )
          continue
        }
        deepStrictEqual(decode(encode(decoded as never)), decoded)
      }
    }
  })
})
