@file:JvmName("TimeHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.MAX_TIME
import gondola.lyrics.model.utils.requireUInt32

/**
 * Creates a TimeRange, the half-open range [start, end); leaving the end unset opens it above.
 *
 * Bounds must fit in uint32, while the schema's stricter time limit is checked by `validateTimeRange`.
 */
fun makeTimeRange(start: Long = 0, end: Long? = null): TimeRange {
    return TimeRange(start = requireUInt32(start), end = end?.let(::requireUInt32))
}

/**
 * Validates a TimeRange: neither bound may hold a value outside the schema's domain, and when both hold a usable one the end may not fall before the start.
 * An unknown end holds no number, so it has neither a domain to check nor anything to compare against the start.
 */
fun validateTimeRange(range: TimeRange, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val start = range.start
    if (start < 0) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.TimeRangeStartInvalid))
    } else if (start > MAX_TIME) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.TimeRangeStartOverflow))
    }
    val end = range.end ?: return diagnostics
    if (end < 0) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.TimeRangeEndInvalid))
    } else if (end > MAX_TIME) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.TimeRangeEndOverflow))
    } else if (start in 0..MAX_TIME && end < start) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.TimeRangeEndBeforeStart))
    }
    return diagnostics
}

/**
 * Returns the length of a TimeRange in milliseconds, or null when it is unset or open above.
 * Compute it signed, so an invalid end below start yields a negative length instead of wrapping around.
 */
fun getTimeRangeDuration(range: TimeRange?): Long? {
    return range?.end?.let { it - range.start }
}

/**
 * Returns how far `at` has progressed through a TimeRange: 0 before its start, 1 from its end on, or null when the TimeRange is unset or open above.
 * A zero-length range therefore jumps from 0 to 1 at its start.
 */
fun getTimeRangeProgress(range: TimeRange?, at: Long): Double? {
    if (range == null || range.end == null) {
        return null
    }
    val start = range.start
    val end = range.end
    return when {
        at < start -> 0.0
        at >= end -> 1.0
        else -> (at - start).toDouble() / (end - start)
    }
}

/**
 * Reports whether `at` falls inside a TimeRange, which includes its start but not its end, so a zero-length range never does.
 * An unknown end leaves the range open above, so every time from the start on falls inside it.
 * An unset TimeRange contains no time.
 */
fun isTimeInTimeRange(range: TimeRange?, at: Long): Boolean {
    return range != null && range.start <= at && (range.end == null || at < range.end)
}
