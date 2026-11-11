import { execFileSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { deepStrictEqual, ok, throws } from 'node:assert/strict'
import { FileDescriptorSetSchema } from '@bufbuild/protobuf/wkt'
import { create, createFileRegistry, fromBinary, toBinary } from '@bufbuild/protobuf'

import { runtime, storage } from '@root/index'
import { read, write } from '@root/utils/wire'
import { decodeRuntimeWordEmphasis, decodeStorageLineContent, encodeRuntimeWordEmphasis, encodeStorageLineContent } from '@root/generated/codec.gen'
import { createRuntimeWordEmphasis, createStorageLineContent } from '@root/generated/detail.gen'

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
  return runtime.makeWordAnnotation({
    rubies: [
      runtime.makeWordAnnotationRuby({ language: 'zh-latn', scheme: 'pinyin', tokens: [runtime.makeWordAnnotationToken({ text: 'han' })] }),
      runtime.makeWordAnnotationRuby({ language: 'ja', time: runtime.makeTimeRange({}), tokens: [runtime.makeWordAnnotationToken({ text: 'あ' })] }),
    ],
    romans: [
      runtime.makeWordAnnotationRoman({
        language: 'ja-latn',
        scheme: 'hepburn',
        tokens: [runtime.makeWordAnnotationToken({ time: runtime.makeTimeRange({ start: 1, end: 0 }), text: 'a' })],
      }),
    ],
    translations: [runtime.makeWordAnnotationTranslation({ language: '', text: '😀' })],
  })
}

const meta = () => {
  return runtime.makeMeta({
    unknowns: [runtime.makeUnknownEntry({ key: 'k', value: 'v' }), runtime.makeUnknownEntry({ key: 'k', value: '' })],
    offset: -1500,
    duration: 2 ** 32 - 1,
    language: 'EN',
    titles: [runtime.makeText({ text: 't' })],
    artists: [runtime.makeText({ language: '', text: 'a' })],
    albums: [runtime.makeText()],
    authors: [runtime.makeText({ text: 'b' })],
    isrcs: ['USRC17607839', ''],
    credits: [runtime.makeMetaCredit({ role: 99 as runtime.CreditRole, raw: '', names: [runtime.makeText({ text: 'c' })] })],
    references: [runtime.makeMetaReference({ platform: 'x', ids: ['1', '2'] })],
  })
}

const lineAnnotation = () => {
  return runtime.makeLineAnnotation({
    romans: [runtime.makeLineAnnotationRoman({ language: 'ja-latn', scheme: 'hepburn', text: 'r' })],
    translations: [runtime.makeLineAnnotationTranslation({ language: 'zh', text: '译' })],
  })
}

const extra = () => {
  const entries: Record<string, string> = { b: '2', a: '', $typeName: 'kept', ключ: 'значение' }
  Object.defineProperty(entries, '__proto__', { value: 'kept', enumerable: true, writable: true, configurable: true })
  return entries
}

const runtimeLyric = (): runtime.Lyric => {
  return runtime.makeLyric({
    format: 'ttml',
    profile: 'amll',
    status: runtime.LyricStatus.VALID,
    timing: 99 as runtime.Timing,
    meta: meta(),
    extra: extra(),
    languages: [runtime.makeLanguageUsage({ tag: 'en', count: 3 })],
    agents: [runtime.makeAgent({ id: 'a', type: -1 as runtime.AgentType, raw: 'x', names: [runtime.makeText({ text: 'n' })] })],
    lines: [
      runtime.makeLineNormal({
        id: 'l',
        time: runtime.makeTimeRange({ start: 0, end: 0 }),
        part: runtime.makePart({ type: runtime.PartType.CHORUS, id: 'Chorus-A', raw: '' }),
        agents: ['a'],
        languages: ['en', ''],
        content: runtime.makeLineContentWords([
          runtime.makeWordNormal({
            text: 'x',
            language: '',
            time: runtime.makeTimeRange({ start: 5 }),
            annotation: annotation(),
            emphasis: runtime.makeWordEmphasis(),
          }),
          runtime.makeWordSpace({ text: ' ' }),
        ]),
        annotation: lineAnnotation(),
        backgrounds: [
          runtime.makeLineBackground({
            id: 'b',
            time: runtime.makeTimeRange({ start: 1 }),
            agents: ['a'],
            languages: ['ja'],
            content: runtime.makeLineContentText(''),
            annotation: runtime.makeLineAnnotation(),
          }),
        ],
      }),
      runtime.makeLineInstrumental(),
    ],
  })
}

const storageLyric = (): storage.Lyric => {
  return storage.makeLyric({
    format: 'ttml',
    profile: 'itunes',
    timing: storage.Timing.WORD,
    meta: meta(),
    extra: extra(),
    agents: [storage.makeAgent({ id: 'a', type: storage.AgentType.GROUP, names: [storage.makeText({ text: 'n' })] })],
    lines: [
      storage.makeLineNormal({
        id: 'l',
        time: storage.makeTimeRange({ start: 0 }),
        part: storage.makePart({ type: storage.PartType.OTHER, id: 'Section-B', raw: 'x' }),
        agents: ['a'],
        languages: ['en'],
        content: storage.makeLineContentWords([
          storage.makeWordNormal({
            text: 'x',
            language: 'en',
            time: storage.makeTimeRange({ start: 5, end: 6 }),
            annotation: annotation(),
            emphasis: false,
          }),
          storage.makeWordNormal({ text: 'y', emphasis: true }),
          storage.makeWordSpace({ text: ' ' }),
        ]),
        annotation: lineAnnotation(),
        backgrounds: [storage.makeLineBackground({ content: storage.makeLineContentText('bg') })],
      }),
    ],
  })
}

const cases = [
  { name: 'lyric.runtime.Lyric', encode: runtime.encode, decode: runtime.decode, build: runtimeLyric },
  { name: 'lyric.storage.Lyric', encode: storage.encode, decode: storage.decode, build: storageLyric },
] as const

describe('protobuf', () => {
  it('preserves optional emphasis fields with the official codec', () => {
    const schema = official('lyric.runtime.WordEmphasis')
    const values = [undefined, false, true]
    for (const value of values) {
      for (const derived of values) {
        const emphasis = runtime.makeWordEmphasis({ value, derived })
        const bytes = toBinary(schema, create(schema, emphasis))
        deepStrictEqual(write(encodeRuntimeWordEmphasis, emphasis), bytes)
        deepStrictEqual(read(createRuntimeWordEmphasis, decodeRuntimeWordEmphasis, bytes), emphasis)
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
    const expected: storage.LineContent = {
      words: [
        { type: storage.WordType.NORMAL, time: { start: 0, end: 0 }, text: 'a' },
        { type: storage.WordType.NORMAL, time: { start: 5 }, language: '', text: 'a', emphasis: false },
        { type: 99 as storage.WordType, text: 'a', emphasis: true },
      ],
      text: '',
    }
    const schema = official('lyric.storage.LineContent')

    deepStrictEqual(read(createStorageLineContent, decodeStorageLineContent, bytes), expected)
    deepStrictEqual(write(encodeStorageLineContent, expected), bytes)
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
      throws(() => runtime.decode(fromHex(hex)), why)
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
      deepStrictEqual(Buffer.from(runtime.encode(runtime.decode(fromHex(input!)))).toString('hex'), output, why)
    }
    deepStrictEqual(
      read(createStorageLineContent, decodeStorageLineContent, fromHex('0a03308001')).words[0]?.emphasis,
      true,
      'any set bit makes a bool true',
    )
  })

  it('rejects a number outside the field range', () => {
    const lyric = runtime.makeLyric({
      format: '',
      status: runtime.LyricStatus.VALID,
      lines: [runtime.makeLineNormal({ time: runtime.makeTimeRange({ start: -1 }) })],
    })
    throws(() => runtime.encode(lyric))
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
