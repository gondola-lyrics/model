#pragma once

#include <cstdint>
#include <optional>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/common/time.gen.hpp>

namespace gondola::lyrics::model::common {
	/**
	 * Builds a half-open range in milliseconds, leaving it open above if the end is absent.
	 *
	 * Bounds that do not fit in uint32 throw std::out_of_range.
	 * The schema limit of 2^31-1 and the ordering of the bounds are checked separately by validateTimeRange().
	 */
	[[nodiscard]] TimeRange makeTimeRange(std::int64_t start = 0, std::optional<std::int64_t> end = std::nullopt);

	/**
	 * Requires each endpoint to be at most 2^31-1 milliseconds and a known end to be at least a usable start.
	 *
	 * Returns no diagnostics for an open or zero-length range within the schema limit.
	 */
	[[nodiscard]] std::vector<Diagnostic> validateTimeRange(const TimeRange& range, std::string_view path = {});

	/**
	 * Returns end minus start in milliseconds, or nullopt if the range or its end is unset.
	 *
	 * Uses the supplied bounds without validation, so a reversed range produces a negative duration.
	 */
	[[nodiscard]] std::optional<std::int64_t> getTimeRangeDuration(const std::optional<TimeRange>& range) noexcept;

	/**
	 * Interpolates progress for a valid range, clamping to 0 before its start and 1 at or after its end.
	 *
	 * time is in milliseconds; an unset range or end returns nullopt, and a zero-length range reaches 1 at its start.
	 * Bounds are used without validation; a present range with an end propagates a NaN time to the result.
	 */
	[[nodiscard]] std::optional<double> getTimeRangeProgress(const std::optional<TimeRange>& range, double time) noexcept;

	/**
	 * Checks membership in milliseconds, including the start and excluding a known end.
	 *
	 * An unset range contains no time, an open range has no upper bound, and a zero-length range contains no time.
	 * Bounds are used without validation; a NaN time returns false.
	 */
	[[nodiscard]] bool isTimeInTimeRange(const std::optional<TimeRange>& range, double time) noexcept;
} // namespace gondola::lyrics::model::common
