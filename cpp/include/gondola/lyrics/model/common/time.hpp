#pragma once

#include <cstdint>
#include <optional>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/common/time.gen.hpp>

namespace gondola::lyrics::model::common {

	/**
 * Builds a half-open range, leaving it open above if the end is absent.
 *
 * Bounds that do not fit in uint32 throw std::out_of_range.
 */
	[[nodiscard]] TimeRange makeTimeRange(std::int64_t start = 0, std::optional<std::int64_t> end = std::nullopt);

	/**
 * Checks the time bounds and reports an end before a usable start.
 */
	[[nodiscard]] std::vector<Diagnostic> validateTimeRange(const TimeRange& range, std::string_view path = {});

	/**
 * Returns the signed length in milliseconds if both bounds are known.
 */
	[[nodiscard]] std::optional<std::int64_t> getTimeRangeDuration(const std::optional<TimeRange>& range) noexcept;

	/**
 * Returns progress from 0 to 1 for a range with a known end.
 *
 * A zero-length range reaches 1 at its start.
 */
	[[nodiscard]] std::optional<double> getTimeRangeProgress(const std::optional<TimeRange>& range, double time) noexcept;

	/**
 * Checks membership, including the start and excluding a known end.
 */
	[[nodiscard]] bool isTimeInTimeRange(const std::optional<TimeRange>& range, double time) noexcept;

} // namespace gondola::lyrics::model::common
