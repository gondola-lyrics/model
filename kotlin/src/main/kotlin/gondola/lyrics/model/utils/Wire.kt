package gondola.lyrics.model.utils

private const val VARINT = 0
private const val FIXED64 = 1
private const val DELIMITED = 2
private const val GROUP_START = 3
private const val GROUP_END = 4
private const val FIXED32 = 5
private const val UINT32_MASK = 0xffffffffL
private const val MAP_KEY_TAG = 10
private const val MAP_VALUE_TAG = 18

// Go counts nested groups inside the outermost skipped group.
private const val MAX_GROUP_DEPTH = 10000

/**
 * Owns the buffers of one encode, so concurrent calls never share mutable state.
 */
private class Writer : WireWriter {
    private var buffer = ByteArray(4096)
    private var size = 0
    private var child: Writer? = null

    private fun ensure(extra: Int) {
        require(extra >= 0 && extra <= Int.MAX_VALUE - size) { "Encoded message is too large" }
        val required = size + extra
        if (required > buffer.size) {
            val capacity = maxOf(buffer.size.toLong() * 2, required.toLong()).coerceAtMost(Int.MAX_VALUE.toLong())
            buffer = buffer.copyOf(capacity.toInt())
        }
    }

    private fun varint(value: Long) {
        ensure(10)
        var remaining = value
        while (remaining and -128L != 0L) {
            buffer[size++] = ((remaining and 127) or 128).toByte()
            remaining = remaining ushr 7
        }
        buffer[size++] = remaining.toByte()
    }

    private fun nested(): Writer {
        val writer = child ?: Writer().also { child = it }
        writer.size = 0
        return writer
    }

    private fun flush(tag: Int, writer: Writer) {
        tag(tag)
        varint(writer.size.toLong())
        ensure(writer.size)
        writer.buffer.copyInto(buffer, size, 0, writer.size)
        size += writer.size
    }

    override fun tag(value: Int) {
        varint(value.toLong() and UINT32_MASK)
    }

    override fun uint32(value: Long) {
        require(value in 0..UINT32_MASK) { "Value must fit in uint32: $value" }
        varint(value)
    }

    override fun int32(value: Int) {
        varint(value.toLong())
    }

    override fun sint32(value: Int) {
        varint(((value shl 1) xor (value shr 31)).toLong() and UINT32_MASK)
    }

    override fun bool(value: Boolean) {
        ensure(1)
        buffer[size++] = if (value) 1 else 0
    }

    override fun string(value: String) {
        var length = 0L
        var index = 0
        while (index < value.length) {
            val unit = value[index].code
            when {
                unit < 0x80 -> length++

                unit < 0x800 -> length += 2

                unit in 0xd800..0xdbff -> {
                    require(index + 1 < value.length && value[index + 1].code in 0xdc00..0xdfff) { "Invalid UTF-16" }
                    length += 4
                    index++
                }

                unit in 0xdc00..0xdfff -> throw IllegalArgumentException("Invalid UTF-16")

                else -> length += 3
            }
            index++
        }
        require(length <= Int.MAX_VALUE) { "Encoded string is too large" }
        varint(length)
        ensure(length.toInt())
        index = 0
        while (index < value.length) {
            var unit = value[index].code
            when {
                unit < 0x80 -> buffer[size++] = unit.toByte()

                unit < 0x800 -> {
                    buffer[size++] = ((unit shr 6) or 0xc0).toByte()
                    buffer[size++] = ((unit and 63) or 0x80).toByte()
                }

                unit in 0xd800..0xdbff -> {
                    unit = 0x10000 + ((unit - 0xd800) shl 10) + value[++index].code - 0xdc00
                    buffer[size++] = ((unit shr 18) or 0xf0).toByte()
                    buffer[size++] = (((unit shr 12) and 63) or 0x80).toByte()
                    buffer[size++] = (((unit shr 6) and 63) or 0x80).toByte()
                    buffer[size++] = ((unit and 63) or 0x80).toByte()
                }

                else -> {
                    buffer[size++] = ((unit shr 12) or 0xe0).toByte()
                    buffer[size++] = (((unit shr 6) and 63) or 0x80).toByte()
                    buffer[size++] = ((unit and 63) or 0x80).toByte()
                }
            }
            index++
        }
    }

    override fun <T> message(tag: Int, encode: (WireWriter, T) -> Unit, value: T) {
        val writer = nested()
        encode(writer, value)
        flush(tag, writer)
    }

    override fun stringMap(tag: Int, entries: Map<String, String>) {
        for ((key, value) in entries) {
            val writer = nested()
            writer.tag(MAP_KEY_TAG)
            writer.string(key)
            writer.tag(MAP_VALUE_TAG)
            writer.string(value)
            flush(tag, writer)
        }
    }

    fun finish(): ByteArray {
        return buffer.copyOf(size)
    }
}

/**
 * Reads bounded message ranges using the wire rules of the Go Protobuf implementation.
 */
private class Reader(private val bytes: ByteArray) : WireReader {
    private var position = 0
    private var end = bytes.size
    private var last = 0

    private fun malformed(): Nothing {
        throw IllegalArgumentException("Malformed wire data")
    }

    private fun byte(): Int {
        if (position >= end) {
            malformed()
        }
        return bytes[position++].toInt() and 255
    }

    private fun varint(): Long {
        var value = 0L
        for (shift in 0..63 step 7) {
            val byte = byte()
            if (shift == 63 && byte > 1) {
                malformed()
            }
            value = value or ((byte and 127).toLong() shl shift)
            if (byte < 128) {
                return value
            }
        }
        malformed()
    }

    private fun length(): Int {
        val length = varint()
        if (length < 0 || length > (end - position).toLong()) {
            malformed()
        }
        return length.toInt()
    }

    private fun advance(count: Int) {
        if (count > end - position) {
            malformed()
        }
        position += count
    }

    override fun more(): Boolean {
        return position < end
    }

    override fun tag(): Int {
        val value = varint()
        if (value ushr 32 != 0L || value ushr 3 == 0L || value and 7 > FIXED32) {
            malformed()
        }
        last = value.toInt()
        return last
    }

    override fun uint32(): Long {
        return varint() and UINT32_MASK
    }

    override fun int32(): Int {
        return varint().toInt()
    }

    override fun sint32(): Int {
        val value = varint().toInt()
        return (value ushr 1) xor -(value and 1)
    }

    override fun bool(): Boolean {
        return varint() != 0L
    }

    override fun string(): String {
        val length = length()
        val start = position
        position += length
        var at = start
        while (at < position && bytes[at] >= 0) {
            at++
        }
        if (at == position) {
            return String(bytes, start, length, Charsets.ISO_8859_1)
        }
        validateUtf8(at, position)
        return String(bytes, start, length, Charsets.UTF_8)
    }

    // Charset decoding replaces malformed sequences unless the bytes are checked first.
    private fun validateUtf8(start: Int, stop: Int) {
        var at = start
        while (at < stop) {
            val first = bytes[at].toInt() and 255
            when {
                first < 0x80 -> at++

                first in 0xc2..0xdf -> {
                    if (stop - at < 2 || !continuation(at + 1)) {
                        malformed()
                    }
                    at += 2
                }

                first in 0xe0..0xef -> {
                    if (stop - at < 3 || !continuation(at + 1) || !continuation(at + 2)) {
                        malformed()
                    }
                    val second = bytes[at + 1].toInt() and 255
                    if ((first == 0xe0 && second < 0xa0) || (first == 0xed && second > 0x9f)) {
                        malformed()
                    }
                    at += 3
                }

                first in 0xf0..0xf4 -> {
                    if (stop - at < 4 || !continuation(at + 1) || !continuation(at + 2) || !continuation(at + 3)) {
                        malformed()
                    }
                    val second = bytes[at + 1].toInt() and 255
                    if ((first == 0xf0 && second < 0x90) || (first == 0xf4 && second > 0x8f)) {
                        malformed()
                    }
                    at += 4
                }

                else -> malformed()
            }
        }
    }

    private fun continuation(at: Int): Boolean {
        return bytes[at].toInt() and 0xc0 == 0x80
    }

    override fun enter(): Int {
        val length = length()
        val previous = end
        end = position + length
        return previous
    }

    override fun leave(previous: Int) {
        if (position != end) {
            malformed()
        }
        end = previous
    }

    override fun mapEntry(target: MutableMap<String, String>) {
        val previous = enter()
        var key = ""
        var value = ""
        while (more()) {
            when (tag()) {
                MAP_KEY_TAG -> key = string()
                MAP_VALUE_TAG -> value = string()
                else -> skip()
            }
        }
        leave(previous)
        target[key] = value
    }

    override fun skip() {
        skipField(last)
    }

    private fun skipField(tag: Int) {
        when (tag and 7) {
            VARINT -> varint()

            FIXED64 -> advance(8)

            DELIMITED -> {
                val length = length()
                position += length
            }

            GROUP_START -> skipGroup(tag)

            FIXED32 -> advance(4)

            else -> malformed()
        }
    }

    private fun skipGroup(tag: Int) {
        var open = IntArray(16)
        open[0] = tag ushr 3
        var depth = 1
        while (depth > 0) {
            val inner = tag()
            when (inner and 7) {
                GROUP_START -> {
                    if (depth > MAX_GROUP_DEPTH) {
                        malformed()
                    }
                    if (depth == open.size) {
                        open = open.copyOf(minOf(open.size * 2, MAX_GROUP_DEPTH + 1))
                    }
                    open[depth++] = inner ushr 3
                }

                GROUP_END -> {
                    if (inner ushr 3 != open[--depth]) {
                        malformed()
                    }
                }

                else -> skipField(inner)
            }
        }
    }
}

/**
 * Encodes a structure with buffers owned by this call.
 */
internal fun <T> write(encode: (WireWriter, T) -> Unit, value: T): ByteArray {
    val writer = Writer()
    encode(writer, value)
    return writer.finish()
}

/**
 * Decodes a structure without retaining the input buffer.
 */
internal fun <T> read(decode: (WireReader) -> T, bytes: ByteArray): T {
    return decode(Reader(bytes))
}
