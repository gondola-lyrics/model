@file:JvmName("TimeHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.MAX_TIME
import gondola.lyrics.model.utils.uint32
import gondola.lyrics.model.utils.unsigned

/**
 * Creates a TimeRange, the half-open range [start, end); leaving the end unset opens it above.
 *
 * Bounds must fit in uint32, while the schema's stricter time limit is checked by `validateTimeRange`.
 */
fun makeTimeRange(start: Long = 0, end: Long? = null): TimeRange {
    val builder = TimeRange.newBuilder().setStart(uint32(start))
    if (end != null) {
        builder.end = uint32(end)
    }
    return builder.build()
}

/**
 * Validates a TimeRange: neither bound may hold a value outside the schema's domain, and when both hold a usable one the end may not fall before the start.
 * An unknown end holds no number, so it has neither a domain to check nor anything to compare against the start.
 */
fun validateTimeRange(range: TimeRange, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val start = unsigned(range.start)
    if (start > MAX_TIME) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.TimeRangeStartOverflow))
    }
    if (!range.hasEnd()) {
        return diagnostics
    }
    val end = unsigned(range.end)
    if (end > MAX_TIME) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.TimeRangeEndOverflow))
    } else if (start <= MAX_TIME && end < start) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.TimeRangeEndBeforeStart))
    }
    return diagnostics
}

/**
 * Returns the length of a TimeRange in milliseconds, or null when it is unset or open above.
 * Compute it signed, so an invalid end below start yields a negative length instead of wrapping around.
 */
fun getTimeRangeDuration(range: TimeRange?): Long? = if (range != null && range.hasEnd()) unsigned(range.end) - unsigned(range.start) else null

/**
 * Returns how far `at` has progressed through a TimeRange: 0 before its start, 1 from its end on, or null when the TimeRange is unset or open above.
 * A zero-length range therefore jumps from 0 to 1 at its start.
 */
fun getTimeRangeProgress(range: TimeRange?, at: Long): Double? {
    if (range == null || !range.hasEnd()) {
        return null
    }
    val start = unsigned(range.start)
    val end = unsigned(range.end)
    return when {
        at < start -> 0.0
        at >= end -> 1.0
        else -> (at - start).toDouble() / (end - start)
    }
}

/**
 * Reports whether `at` falls inside a TimeRange, which includes its start but not its end, so a zero-length range never does.
 * An unknown end leaves the range open above, so every time from the start on falls inside it.
 * An unset TimeRange is never active.
 */
fun isTimeRangeActive(range: TimeRange?, at: Long): Boolean =
    range != null && unsigned(range.start) <= at && (!range.hasEnd() || at < unsigned(range.end))
