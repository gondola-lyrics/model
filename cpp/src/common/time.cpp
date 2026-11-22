#include <gondola/lyrics/model/common/time.hpp>

#include "utils/common.hpp"

namespace gondola::lyrics::model::common {
	TimeRange makeTimeRange(std::int64_t start, std::optional<std::int64_t> end) {
		return {utils::requireUint32(start), end ? std::optional{utils::requireUint32(*end)} : std::nullopt};
	}

	std::vector<Diagnostic> validateTimeRange(const TimeRange& range, std::string_view path) {
		std::vector<Diagnostic> diagnostics;
		if (range.start > utils::kMaxTime) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kTimeRangeStartOverflow});
		}
		if (range.end) {
			if (*range.end > utils::kMaxTime) {
				diagnostics.push_back({std::string(path), DiagnosticCode::kTimeRangeEndOverflow});
			} else if (range.start <= utils::kMaxTime && *range.end < range.start) {
				diagnostics.push_back({std::string(path), DiagnosticCode::kTimeRangeEndBeforeStart});
			}
		}
		return diagnostics;
	}

	std::optional<std::int64_t> getTimeRangeDuration(const std::optional<TimeRange>& range) noexcept {
		if (!range || !range->end) {
			return std::nullopt;
		}
		return static_cast<std::int64_t>(*range->end) - range->start;
	}

	std::optional<double> getTimeRangeProgress(const std::optional<TimeRange>& range, double time) noexcept {
		if (!range || !range->end) {
			return std::nullopt;
		}
		const auto start = static_cast<double>(range->start);
		const auto end   = static_cast<double>(*range->end);
		if (time < start) {
			return 0.0;
		}
		if (time >= end) {
			return 1.0;
		}
		return (time - start) / (end - start);
	}

	bool isTimeInTimeRange(const std::optional<TimeRange>& range, double time) noexcept {
		return range && range->start <= time && (!range->end || time < *range->end);
	}
} // namespace gondola::lyrics::model::common
