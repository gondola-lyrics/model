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

	inline void appendDiagnostics(std::vector<common::Diagnostic>& diagnostics, std::vector<common::Diagnostic> entries) {
		diagnostics.insert(diagnostics.end(), std::make_move_iterator(entries.begin()), std::make_move_iterator(entries.end()));
	}

	template <typename T>
	void unsetIfDefault(std::optional<T>& value) {
		if (value && *value == T{}) {
			value.reset();
		}
	}

	template <typename T, typename Canonicalize>
	void canonicalizeField(std::optional<T>& value, Canonicalize canonicalize) {
		if (value) {
			*value = canonicalize(std::move(*value));
			unsetIfDefault(value);
		}
	}

	template <typename T>
	void reportDefaultEntry(const T& value, std::string path, std::vector<common::Diagnostic>& diagnostics) {
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
	std::string annotationVariantKey(const T& annotation) {
		const auto language = languageKey(annotation.language);
		// A length prefix keeps arbitrary scheme text from colliding with another language and scheme pair.
		auto key = std::to_string(language.size());
		key += ':';
		key += language;
		key += languageKey(annotation.scheme);
		return key;
	}

	inline void appendLanguage(std::string_view language, std::unordered_set<std::string>& seen, std::vector<std::string>& languages) {
		if (!language.empty()) {
			auto tag = lowercaseAscii(language);
			if (seen.insert(tag).second) {
				languages.push_back(std::move(tag));
			}
		}
	}

	inline std::vector<std::string> normalizedLanguages(const std::vector<std::string>& languages) {
		std::vector<std::string>        normalized;
		std::unordered_set<std::string> seen;
		for (const auto& language : languages) {
			appendLanguage(language, seen, normalized);
		}
		return normalized;
	}

	template <typename T>
	std::string joinText(const std::vector<T>& items) {
		std::string text;
		for (const auto& item : items) {
			text += item.text;
		}
		return text;
	}

	inline bool isTimedContent(common::TimingLevel timing) noexcept {
		return timing == common::TimingLevel::kLine || timing == common::TimingLevel::kWord;
	}

	inline bool isTimeOrdered(const std::optional<common::TimeRange>& time) noexcept {
		return time && time->start <= kMaxTime && (!time->end || (*time->end >= time->start && *time->end <= kMaxTime));
	}

	inline std::uint32_t comparableEnd(const common::TimeRange& time) noexcept {
		return time.end.value_or(std::numeric_limits<std::uint32_t>::max());
	}

	inline bool isTimeUncovered(const std::optional<common::TimeRange>& time, const std::optional<common::TimeRange>& parent) noexcept {
		return isTimeOrdered(time) && isTimeOrdered(parent) && (time->start < parent->start || comparableEnd(*time) > comparableEnd(*parent));
	}

	template <typename T>
	void reportUnordered(const std::vector<T>& items,
		std::string_view                   path,
		std::string_view                   field,
		common::DiagnosticCode             code,
		std::vector<common::Diagnostic>&   diagnostics) {
		std::optional<std::uint32_t> last;
		for (std::size_t index = 0; index < items.size(); ++index) {
			const auto& time = items[index].time;
			if (isTimeOrdered(time)) {
				if (last && time->start < *last) {
					diagnostics.push_back({indexedPath(path, field, index), code});
				}
				last = time->start;
			}
		}
	}

	template <typename T>
	void sortByStart(std::vector<T>& items) {
		std::stable_sort(items.begin(), items.end(), [](const T& a, const T& b) {
			return isTimeOrdered(a.time) && (!isTimeOrdered(b.time) || a.time->start < b.time->start);
		});
	}

} // namespace gondola::lyrics::model::utils
