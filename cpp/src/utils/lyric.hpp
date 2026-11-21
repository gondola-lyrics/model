#pragma once

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <iterator>
#include <limits>
#include <optional>
#include <string>
#include <string_view>
#include <unordered_set>
#include <utility>
#include <vector>

#include <gondola/lyrics/model/generated/common/time.gen.hpp>

#include "utils/common.hpp"

namespace gondola::lyrics::model::utils {

	inline void append_diagnostics(std::vector<common::Diagnostic>& diagnostics, std::vector<common::Diagnostic> entries) {
		diagnostics.insert(diagnostics.end(), std::make_move_iterator(entries.begin()), std::make_move_iterator(entries.end()));
	}

	template <typename T>
	void unset_if_default(std::optional<T>& value) {
		if (value && *value == T{}) {
			value.reset();
		}
	}

	template <typename T, typename Canonicalize>
	void canonicalize_field(std::optional<T>& value, Canonicalize canonicalize) {
		if (value) {
			*value = canonicalize(std::move(*value));
			unset_if_default(value);
		}
	}

	template <typename T>
	void report_default_entry(const T& value, std::string path, std::vector<common::Diagnostic>& diagnostics) {
		if (value != T{}) {
			return;
		}
		const auto covers = [&](const common::Diagnostic& diagnostic) {
			const std::string_view reported = diagnostic.path;
			return reported == path ||
				(reported.size() > path.size() && reported.compare(0, path.size(), path) == 0 && (reported[path.size()] == '.' || reported[path.size()] == '['));
		};
		if (std::none_of(diagnostics.begin(), diagnostics.end(), covers)) {
			diagnostics.push_back({std::move(path), common::DiagnosticCode::kLyricListEntryEmpty});
		}
	}

	template <typename T>
	std::string annotation_variant_key(const T& annotation) {
		const auto language = language_key(annotation.language);
		// A length prefix keeps arbitrary scheme text from colliding with another language and scheme pair.
		auto key = std::to_string(language.size());
		key += ':';
		key += language;
		key += language_key(annotation.scheme);
		return key;
	}

	inline void append_language(std::string_view language, std::unordered_set<std::string>& seen, std::vector<std::string>& languages) {
		if (!language.empty()) {
			auto tag = lowercase_ascii(language);
			if (seen.insert(tag).second) {
				languages.push_back(std::move(tag));
			}
		}
	}

	inline std::vector<std::string> normalized_languages(const std::vector<std::string>& languages) {
		std::vector<std::string>        normalized;
		std::unordered_set<std::string> seen;
		for (const auto& language : languages) {
			append_language(language, seen, normalized);
		}
		return normalized;
	}

	template <typename T>
	std::string join_text(const std::vector<T>& items) {
		std::string text;
		for (const auto& item : items) {
			text += item.text;
		}
		return text;
	}

	inline bool is_timed_content(common::TimingLevel timing) noexcept {
		return timing == common::TimingLevel::kLine || timing == common::TimingLevel::kWord;
	}

	inline bool is_time_ordered(const std::optional<common::TimeRange>& time) noexcept {
		return time && time->start <= kMaxTime && (!time->end || (*time->end >= time->start && *time->end <= kMaxTime));
	}

	inline std::uint32_t comparable_end(const common::TimeRange& time) noexcept {
		return time.end.value_or(std::numeric_limits<std::uint32_t>::max());
	}

	inline bool is_time_uncovered(const std::optional<common::TimeRange>& time, const std::optional<common::TimeRange>& parent) noexcept {
		return is_time_ordered(time) && is_time_ordered(parent) && (time->start < parent->start || comparable_end(*time) > comparable_end(*parent));
	}

	template <typename T>
	void report_unordered(const std::vector<T>& items,
		std::string_view                    path,
		std::string_view                    field,
		common::DiagnosticCode              code,
		std::vector<common::Diagnostic>&    diagnostics) {
		std::optional<std::uint32_t> last;
		for (std::size_t index = 0; index < items.size(); ++index) {
			const auto& time = items[index].time;
			if (is_time_ordered(time)) {
				if (last && time->start < *last) {
					diagnostics.push_back({indexed_path(path, field, index), code});
				}
				last = time->start;
			}
		}
	}

	template <typename T>
	void sort_by_start(std::vector<T>& items) {
		std::stable_sort(items.begin(), items.end(), [](const T& a, const T& b) {
			return is_time_ordered(a.time) && (!is_time_ordered(b.time) || a.time->start < b.time->start);
		});
	}

} // namespace gondola::lyrics::model::utils
