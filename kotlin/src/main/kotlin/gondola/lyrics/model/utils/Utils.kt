@file:JvmName("UtilsHelper")

package gondola.lyrics.model.utils

import com.google.protobuf.Descriptors
import com.google.protobuf.Message
import gondola.lyrics.model.common.TimeRange

/**
 * The schema declares a time above this bound invalid.
 */
internal const val MAX_TIME: Long = 2147483647L

/**
 * A uint32 count spans the whole unsigned 32-bit range.
 */
internal const val MAX_COUNT: Long = 4294967295L

/**
 * Matches a full semantic version, per semver.org.
 */
internal val SEMVER_PATTERN =
    Regex(
        "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)" +
            "(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?" +
            "(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$",
    )

/**
 * Converts a uint32 value to the bit pattern stored by generated Java messages without silently truncating it.
 */
internal fun uint32(value: Long): Int {
    require(value in 0..MAX_COUNT) { "Value must fit in uint32: $value" }
    return value.toInt()
}

/**
 * Reads a generated uint32 Int as an unsigned Long before comparison or arithmetic.
 */
internal fun unsigned(value: Int): Long = value.toLong() and MAX_COUNT

/**
 * Joins a parent diagnostic path with a child segment, so a nested field reads as `lines[0].words[1]`.
 */
internal fun childPath(parent: String, child: String): String = if (parent.isEmpty()) child else "$parent.$child"

/**
 * Lowercases a language tag to canonical form, treating an empty or unset tag as unset.
 */
internal fun lowerTag(tag: String?): String? = tag?.takeIf { it.isNotEmpty() }?.lowercase()

/**
 * Compares two language tags the way the schema reads them, which is without case, so an order by tag never turns on how one was spelled.
 */
internal fun compareTags(a: String, b: String): Int = a.lowercase().compareTo(b.lowercase())

/**
 * Scores a lowercased tag against a lowercased range as the length they share when either extends the other on a subtag boundary, so `ja` never matches `jav`.
 * An exact match scores one more, outranking a tag that only extends the range, and anything else scores 0.
 */
internal fun scoreTag(tag: String, range: String): Int = when {
    tag == range -> range.length + 1
    tag.startsWith("$range-") -> range.length
    range.startsWith("$tag-") -> tag.length
    else -> 0
}

/**
 * Reports whether a time range is set and both its bounds hold numbers the schema allows, so comparing it against another range is meaningful.
 * An unknown end holds no number, so it has no domain to fall outside of.
 */
internal fun isTimeRangeInDomain(range: TimeRange?): Boolean =
    range != null && unsigned(range.start) <= MAX_TIME && (!range.hasEnd() || unsigned(range.end) <= MAX_TIME)

/**
 * Reports whether a time range is in domain and runs the right way, which is what relating two ranges to each other needs on top of their numbers being usable.
 */
internal fun isTimeRangeOrdered(range: TimeRange?): Boolean =
    isTimeRangeInDomain(range) && (!range!!.hasEnd() || unsigned(range.end) >= unsigned(range.start))

/**
 * Returns a time range's end as a number two ranges can be compared on, where an unknown end is open above and so ranks past every value a bound may hold.
 * Long.MAX_VALUE stands in for an unknown end outside the schema's domain, so no end a range may actually hold can equal it.
 */
internal fun getTimeRangeEnd(range: TimeRange?): Long = if (range != null && range.hasEnd()) unsigned(range.end) else Long.MAX_VALUE

/**
 * Reports whether a range reaches past either bound of the one containing it.
 * Relating two ranges needs both to run the right way, so a range already reported for its own numbers joins no comparison on either side, and an unset one has nothing to fall outside of.
 */
internal fun isTimeRangeUncovered(range: TimeRange?, parent: TimeRange?): Boolean {
    if (!isTimeRangeOrdered(range) || !isTimeRangeOrdered(parent)) {
        return false
    }
    return unsigned(range!!.start) < unsigned(parent!!.start) || getTimeRangeEnd(range) > getTimeRangeEnd(parent)
}

/**
 * Collects the indexes of entries whose key an earlier entry already took, so a list holding one entry per key can report every repeat without reordering or merging anything.
 */
internal fun <T> findDuplicates(items: List<T>, key: (T) -> String): List<Int> {
    val seen = mutableSetOf<String>()
    return items.mapIndexedNotNull { index, item -> if (seen.add(key(item))) null else index }
}

/**
 * Collects the indexes of entries whose start time falls before the last start seen, so a list the schema declares ordered can report every entry out of place.
 * Entries carrying no usable range are passed over rather than treated as early, since a range that says nothing about when it starts cannot say it starts too soon.
 */
internal fun <T> findUnordered(items: List<T>, bounds: (T) -> TimeRange?): List<Int> {
    val unordered = mutableListOf<Int>()
    var last: Long? = null
    items.forEachIndexed { index, item ->
        val range = bounds(item)
        if (isTimeRangeOrdered(range)) {
            val start = unsigned(range!!.start)
            if (last != null && start < last!!) {
                unordered.add(index)
            }
            last = start
        }
    }
    return unordered
}

/**
 * Builds a comparator ordering items by start ascending then end ascending, reading each item's bounds through a callback.
 * An unknown end is open above, so among equal starts it orders after every known one.
 * An item whose range cannot be related to another's claims no place among those that can, so it keeps its own order after all of them; `findUnordered` passes over exactly those items, so ordering and validating never contradict each other.
 */
internal fun <T> byTime(bounds: (T) -> TimeRange?): Comparator<T> = Comparator { a, b ->
    val x = bounds(a)
    val y = bounds(b)
    when {
        !isTimeRangeOrdered(x) -> if (isTimeRangeOrdered(y)) 1 else 0

        !isTimeRangeOrdered(y) -> -1

        else -> {
            val start = unsigned(x!!.start).compareTo(unsigned(y!!.start))
            if (start != 0) start else getTimeRangeEnd(x).compareTo(getTimeRangeEnd(y))
        }
    }
}

/**
 * Drops an all-default submessage to null so empty and unset encode alike, keeping a meaningful one as is.
 * Unknown fields count as payload because generated message equality includes them.
 */
internal fun <T : Message> dropDefault(message: T?): T? = message?.takeUnless { it == it.defaultInstanceForType }

/**
 * Canonicalizes an optional submessage through a callback, then drops it when the result is all-default.
 */
internal fun <T : Message> canonicalizeField(message: T?, canon: (T) -> T): T? = message?.let { dropDefault(canon(it)) }

/**
 * Canonicalizes each entry of a repeated submessage field through a callback, then drops every all-default entry.
 */
internal fun <T : Message> canonicalizeList(messages: List<T>, canon: (T) -> T): List<T> = messages.mapNotNull { dropDefault(canon(it)) }

/**
 * Walks a message from its schema, collecting the path of every entry in a repeated field that is all default.
 */
private fun collectDefaultEntries(message: Message, path: String): List<String> {
    // A time range says when something happens even when it says nothing about its bounds, while every other message reads the same empty as unset.
    if (message.descriptorForType == TimeRange.getDescriptor()) {
        return emptyList()
    }
    val found = mutableListOf<String>()
    for (field in message.descriptorForType.fields) {
        val child = childPath(path, field.jsonName)
        if (field.isMapField) {
            continue
        }
        if (field.isRepeated) {
            val values = message.getField(field) as List<*>
            values.forEachIndexed { index, value ->
                val entryPath = "$child[$index]"
                if (value is Message) {
                    if (dropDefault(value) == null) {
                        found.add(entryPath)
                    }
                    found.addAll(collectDefaultEntries(value, entryPath))
                } else if (field.javaType == Descriptors.FieldDescriptor.JavaType.STRING && value == "") {
                    // An empty string is the scalar default, and a repeated string field never holds one for the same reason as a message entry.
                    found.add(entryPath)
                }
            }
        } else if (field.javaType == Descriptors.FieldDescriptor.JavaType.MESSAGE && message.hasField(field)) {
            found.addAll(collectDefaultEntries(message.getField(field) as Message, child))
        }
    }
    return found
}

/**
 * Collects the path of every entry in a repeated field that is all default, reading the whole tree from its schema.
 * A repeated field never holds one, since a list the source never mentioned at that index shifts the ones after it and counts as a declaration of its own.
 * `covered` holds the paths an existing diagnostic locates, which silence an entry at or above them, so a rule that already spoke about a field is not restated by this sweep.
 */
internal fun findDefaultEntries(message: Message, covered: List<String> = emptyList()): List<String> =
    collectDefaultEntries(message, "").filter { path ->
        covered.none { other -> other == path || other.startsWith("$path.") || other.startsWith("$path[") }
    }
