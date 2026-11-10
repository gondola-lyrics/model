import type { WireReader, WireWriter } from '@root/generated/internal.gen'

const VARINT = 0
const FIXED64 = 1
const DELIMITED = 2
const GROUP_START = 3
const GROUP_END = 4
const FIXED32 = 5

const MAX_INT32 = 0x7fffffff
const MIN_INT32 = -0x80000000
const MAX_UINT32 = 0xffffffff

/**
 * Matches Go's recursion limit inside a skipped group; the outermost group does not count toward the limit.
 */
const MAX_GROUP_DEPTH = 10000

/**
 * The tag of a map entry's key and of its value, which every map in the wire format shares.
 */
const MAP_KEY_TAG = 10
const MAP_VALUE_TAG = 18

/**
 * Strings no longer than this are tried by hand first, since a call into the decoder costs more than the loop for short ASCII.
 */
const ASCII_SCAN_LIMIT = 32

/**
 * Created on first use, so a bundler sees no module-level work and can drop the whole codec.
 */
let decoder: TextDecoder | undefined

/**
 * Reused across encodes so its buffers are not allocated each time, and created on first use for the same reason as the decoder.
 */
let shared: Writer | undefined

/**
 * Writes the wire format into a growing buffer.
 * A nested structure goes through a child kept for that depth, since its length has to be written before its content; the schema has no recursion, so the depth is bounded.
 */
class Writer implements WireWriter {
  size = 0
  private buffer = new Uint8Array(4096)
  private child: Writer | undefined

  private ensure(extra: number): void {
    if (this.size + extra > this.buffer.length) {
      const next = new Uint8Array(Math.max(this.buffer.length * 2, this.size + extra))
      next.set(this.buffer.subarray(0, this.size))
      this.buffer = next
    }
  }

  private varint(value: number): void {
    this.ensure(5)
    while (value > 127) {
      this.buffer[this.size++] = (value & 127) | 128
      value >>>= 7
    }
    this.buffer[this.size++] = value
  }

  private nested(): Writer {
    const child = (this.child ??= new Writer())
    child.size = 0
    return child
  }

  private flush(tag: number, child: Writer): void {
    this.varint(tag)
    this.varint(child.size)
    this.ensure(child.size)
    this.buffer.set(child.buffer.subarray(0, child.size), this.size)
    this.size += child.size
  }

  /**
   * Writes a field tag the generator already computed.
   */
  tag(tag: number): void {
    this.varint(tag)
  }

  /**
   * Writes a uint32, throwing on anything the field cannot hold rather than wrapping it.
   */
  uint32(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > MAX_UINT32) {
      throw new Error(`invalid uint32: ${value}`)
    }
    this.varint(value)
  }

  /**
   * Writes an int32, the form enums take on the wire, where a negative value sign-extends to ten bytes.
   */
  int32(value: number): void {
    if (!Number.isInteger(value) || value < MIN_INT32 || value > MAX_INT32) {
      throw new Error(`invalid int32: ${value}`)
    }
    if (value >= 0) {
      this.varint(value)
      return
    }
    this.ensure(10)
    let low = value >>> 0
    for (let i = 0; i < 4; i++) {
      this.buffer[this.size++] = (low & 127) | 128
      low >>>= 7
    }
    this.buffer[this.size++] = (low & 127) | 0x70 | 128
    for (let i = 0; i < 4; i++) {
      this.buffer[this.size++] = 0xff
    }
    this.buffer[this.size++] = 1
  }

  /**
   * Writes a sint32 in zigzag form, throwing on anything the field cannot hold rather than wrapping it.
   */
  sint32(value: number): void {
    if (!Number.isInteger(value) || value < MIN_INT32 || value > MAX_INT32) {
      throw new Error(`invalid sint32: ${value}`)
    }
    this.varint(((value << 1) ^ (value >> 31)) >>> 0)
  }

  bool(value: boolean): void {
    this.ensure(1)
    this.buffer[this.size++] = value ? 1 : 0
  }

  /**
   * Writes a string as UTF-8 behind its length, throwing on a lone surrogate instead of replacing it the way TextEncoder would.
   */
  string(text: string): void {
    let size = 0
    const length = text.length
    for (let i = 0; i < length; i++) {
      const unit = text.charCodeAt(i)
      if (unit < 0x80) {
        size += 1
      } else if (unit < 0x800) {
        size += 2
      } else if (unit >= 0xd800 && unit <= 0xdbff) {
        const low = i + 1 < length ? text.charCodeAt(i + 1) : 0
        if (low < 0xdc00 || low > 0xdfff) {
          throw new Error('string is not well-formed UTF-16')
        }
        size += 4
        i++
      } else if (unit >= 0xdc00 && unit <= 0xdfff) {
        throw new Error('string is not well-formed UTF-16')
      } else {
        size += 3
      }
    }
    this.varint(size)
    this.ensure(size)
    const buffer = this.buffer
    let at = this.size
    if (size === length) {
      for (let i = 0; i < length; i++) {
        buffer[at++] = text.charCodeAt(i)
      }
      this.size = at
      return
    }
    for (let i = 0; i < length; i++) {
      let unit = text.charCodeAt(i)
      if (unit < 0x80) {
        buffer[at++] = unit
      } else if (unit < 0x800) {
        buffer[at++] = (unit >> 6) | 0xc0
        buffer[at++] = (unit & 63) | 0x80
      } else if (unit >= 0xd800 && unit <= 0xdbff) {
        unit = 0x10000 + ((unit - 0xd800) << 10) + (text.charCodeAt(++i) - 0xdc00)
        buffer[at++] = (unit >> 18) | 0xf0
        buffer[at++] = ((unit >> 12) & 63) | 0x80
        buffer[at++] = ((unit >> 6) & 63) | 0x80
        buffer[at++] = (unit & 63) | 0x80
      } else {
        buffer[at++] = (unit >> 12) | 0xe0
        buffer[at++] = ((unit >> 6) & 63) | 0x80
        buffer[at++] = (unit & 63) | 0x80
      }
    }
    this.size = at
  }

  message<T>(tag: number, encode: (writer: WireWriter, value: T) => void, value: T): void {
    const child = this.nested()
    encode(child, value)
    this.flush(tag, child)
  }

  /**
   * Writes a string map, one entry per key with both its key and its value present, in the object's own iteration order.
   */
  map(tag: number, entries: Record<string, string>): void {
    for (const key of Object.keys(entries)) {
      const child = this.nested()
      child.tag(MAP_KEY_TAG)
      child.string(key)
      child.tag(MAP_VALUE_TAG)
      child.string(entries[key]!)
      this.flush(tag, child)
    }
  }

  /**
   * Returns a copy of what was written, since the buffer goes on to serve the next encode.
   */
  finish(): Uint8Array {
    return this.buffer.slice(0, this.size)
  }
}

/**
 * Reads the wire format, confined at any moment to the range of the structure being read.
 * Wire handling is based on the Go Protobuf implementation.
 */
class Reader implements WireReader {
  private position = 0
  private end: number
  private last = 0
  private readonly bytes: Uint8Array

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
    this.end = bytes.length
  }

  private byte(): number {
    if (this.position >= this.end) {
      throw new Error('truncated message')
    }
    return this.bytes[this.position++]!
  }

  /**
   * Reads a varint as its low 32 bits unsigned, consuming all of it.
   */
  private low(): number {
    let byte = this.byte()
    let value = byte & 127
    if (byte < 128) {
      return value
    }
    byte = this.byte()
    value |= (byte & 127) << 7
    if (byte < 128) {
      return value
    }
    byte = this.byte()
    value |= (byte & 127) << 14
    if (byte < 128) {
      return value
    }
    byte = this.byte()
    value |= (byte & 127) << 21
    if (byte < 128) {
      return value
    }
    byte = this.byte()
    value = (value | ((byte & 15) << 28)) >>> 0
    if (byte < 128) {
      return value
    }
    this.tail()
    return value
  }

  /**
   * Consumes what a varint holds past its fifth byte, which no field keeps but which still has to fit in ten bytes.
   */
  private tail(): void {
    for (let i = 0; i < 5; i++) {
      const byte = this.byte()
      if (byte < 128) {
        if (i === 4 && byte > 1) {
          throw new Error('varint overflows 64 bits')
        }
        return
      }
    }
    throw new Error('varint overflows 64 bits')
  }

  /**
   * Reads a length prefix, which has to fit in what remains of the current range.
   */
  private length(): number {
    let value = 0
    let scale = 1
    for (let i = 0; i < 10; i++) {
      const byte = this.byte()
      value += (byte & 127) * scale
      scale *= 128
      if (byte < 128) {
        if (i === 9 && byte > 1) {
          throw new Error('varint overflows 64 bits')
        }
        if (value > this.end - this.position) {
          throw new Error('truncated message')
        }
        return value
      }
    }
    throw new Error('varint overflows 64 bits')
  }

  private advance(count: number): void {
    if (count > this.end - this.position) {
      throw new Error('truncated message')
    }
    this.position += count
  }

  private skipField(tag: number): void {
    switch (tag & 7) {
      case VARINT:
        this.low()
        break
      case FIXED64:
        this.advance(8)
        break
      case DELIMITED: {
        const size = this.length()
        this.position += size
        break
      }
      case GROUP_START:
        this.skipGroup(tag)
        break
      case FIXED32:
        this.advance(4)
        break
      default:
        throw new Error('stray end group')
    }
  }

  /**
   * Skips a group by tracking the open ones in a stack, since recursing as deep as the limit could overflow the call stack.
   */
  private skipGroup(tag: number): void {
    const open = [tag >>> 3]
    while (open.length > 0) {
      const inner = this.tag()
      switch (inner & 7) {
        case GROUP_START:
          if (open.length > MAX_GROUP_DEPTH) {
            throw new Error('group nested too deep')
          }
          open.push(inner >>> 3)
          break
        case GROUP_END:
          if (inner >>> 3 !== open.pop()) {
            throw new Error('mismatched end group')
          }
          break
        default:
          this.skipField(inner)
      }
    }
  }

  /**
   * Reports whether the current range holds more bytes.
   */
  more(): boolean {
    return this.position < this.end
  }

  /**
   * Reads a field tag, rejecting a field number past what a schema may declare, field number 0 and the wire types that do not exist.
   */
  tag(): number {
    const start = this.position
    const tag = this.low()
    if (this.exceedsLow(start) || tag >>> 3 === 0 || (tag & 7) > FIXED32) {
      throw new Error('invalid tag')
    }
    this.last = tag
    return tag
  }

  /**
   * Reports whether the varint read from `start` sets a bit above the low 32, so a small value padded past five bytes is not mistaken for a large one.
   */
  private exceedsLow(start: number): boolean {
    if (this.position - start < 5) {
      return false
    }
    if ((this.bytes[start + 4]! & 0x70) !== 0) {
      return true
    }
    for (let at = start + 5; at < this.position; at++) {
      if ((this.bytes[at]! & 127) !== 0) {
        return true
      }
    }
    return false
  }

  /**
   * Reads a uint32 as the varint's low 32 bits.
   */
  uint32(): number {
    return this.low()
  }

  /**
   * Reads an int32 as the varint's low 32 bits, the form enums take on the wire.
   */
  int32(): number {
    return this.low() | 0
  }

  /**
   * Reads a sint32 from its zigzag form.
   */
  sint32(): number {
    const value = this.low()
    return (value >>> 1) ^ -(value & 1)
  }

  /**
   * Reads a bool, true when any bit of the varint is set.
   */
  bool(): boolean {
    let set = false
    for (let i = 0; i < 10; i++) {
      const byte = this.byte()
      if ((byte & 127) !== 0) {
        set = true
      }
      if (byte < 128) {
        if (i === 9 && byte > 1) {
          throw new Error('varint overflows 64 bits')
        }
        return set
      }
    }
    throw new Error('varint overflows 64 bits')
  }

  /**
   * Reads a string, throwing on malformed UTF-8 and keeping a leading BOM, so a round trip never changes what the text holds.
   */
  string(): string {
    const size = this.length()
    const start = this.position
    const stop = start + size
    this.position = stop
    if (size <= ASCII_SCAN_LIMIT) {
      const bytes = this.bytes
      let text = ''
      let at = start
      for (; at < stop; at++) {
        const byte = bytes[at]!
        if (byte >= 128) {
          break
        }
        text += String.fromCharCode(byte)
      }
      if (at === stop) {
        return text
      }
    }
    decoder ??= new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
    return decoder.decode(this.bytes.subarray(start, stop))
  }

  /**
   * Narrows the range to a nested structure, returning the outer end for `leave` to restore.
   */
  enter(): number {
    const size = this.length()
    const previous = this.end
    this.end = this.position + size
    return previous
  }

  /**
   * Restores the outer range, throwing unless the nested structure was read up to its end.
   */
  leave(previous: number): void {
    if (this.position !== this.end) {
      throw new Error('message overrun')
    }
    this.end = previous
  }

  /**
   * Reads one map entry into `target`, a missing key or value reading as an empty string and a repeated key overwriting the earlier one.
   */
  mapEntry(target: Record<string, string>): void {
    const previous = this.enter()
    let key = ''
    let value = ''
    while (this.more()) {
      const tag = this.tag()
      if (tag === MAP_KEY_TAG) {
        key = this.string()
      } else if (tag === MAP_VALUE_TAG) {
        value = this.string()
      } else {
        this.skip()
      }
    }
    this.leave(previous)
    // Assigning to `__proto__` would set the prototype rather than store the entry.
    if (key === '__proto__') {
      Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true })
    } else {
      target[key] = value
    }
  }

  /**
   * Skips the field whose tag was read last, for a number the schema does not define or a wire type that does not match it.
   */
  skip(): void {
    this.skipField(this.last)
  }
}

/**
 * Encodes a structure through its generated encoder.
 */
export const write = <T>(encode: (writer: WireWriter, value: T) => void, value: T): Uint8Array => {
  shared ??= new Writer()
  shared.size = 0
  encode(shared, value)
  return shared.finish()
}

/**
 * Decodes a structure through its generated decoder, into a fresh one holding the defaults.
 */
export const read = <T>(create: () => T, decode: (reader: WireReader, message: T) => void, bytes: Uint8Array): T => {
  const message = create()
  decode(new Reader(bytes), message)
  return message
}
