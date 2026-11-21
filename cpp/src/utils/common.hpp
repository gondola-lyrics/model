#pragma once

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <iterator>
#include <limits>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <unordered_set>
#include <utility>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/common/language.hpp>

namespace gondola::lyrics::model::utils {

	inline constexpr auto kMaxTime = static_cast<std::uint32_t>(std::numeric_limits<std::int32_t>::max());

	inline std::uint32_t require_uint32(std::int64_t value) {
		if (value < 0 || value > static_cast<std::int64_t>(std::numeric_limits<std::uint32_t>::max())) {
			throw std::out_of_range("Value must fit in uint32");
		}
		return static_cast<std::uint32_t>(value);
	}

	inline std::string child_path(std::string_view parent, std::string_view child) {
		if (parent.empty()) {
			return std::string(child);
		}
		std::string path(parent);
		path += '.';
		path += child;
		return path;
	}

	inline std::string indexed_path(std::string_view parent, std::string_view field, std::size_t index) {
		auto path = child_path(parent, field);
		path += '[';
		path += std::to_string(index);
		path += ']';
		return path;
	}

	inline std::string lowercase_ascii(std::string_view value) {
		std::string result(value);
		for (auto& ch : result) {
			if (ch >= 'A' && ch <= 'Z') {
				ch = static_cast<char>(ch + ('a' - 'A'));
			}
		}
		return result;
	}

	inline std::string language_key(const std::optional<std::string>& language) {
		return language ? lowercase_ascii(*language) : std::string{};
	}

	inline void normalize_language(std::optional<std::string>& language) {
		if (language && language->empty()) {
			language.reset();
		} else if (language) {
			*language = lowercase_ascii(*language);
		}
	}

	inline void validate_language(const std::optional<std::string>& language, std::string_view parent, std::vector<common::Diagnostic>& diagnostics) {
		if (language && !language->empty() && !common::isWellFormedLanguageTag(*language)) {
			diagnostics.push_back({child_path(parent, "language"), common::DiagnosticCode::kLanguageTagMalformed});
		}
	}

	template <typename T, typename Key>
	void report_duplicates(const std::vector<T>& values,
		Key                                  key,
		std::string_view                     path,
		std::string_view                     field,
		common::DiagnosticCode               code,
		std::vector<common::Diagnostic>&     diagnostics) {
		std::unordered_set<std::string> seen;
		for (std::size_t index = 0; index < values.size(); ++index) {
			if (!seen.insert(key(values[index])).second) {
				diagnostics.push_back({indexed_path(path, field, index), code});
			}
		}
	}

	template <typename T, typename Validate>
	void validate_entries(const std::vector<T>& values, Validate validate, std::string_view path, std::string_view field, std::vector<common::Diagnostic>& diagnostics) {
		for (std::size_t index = 0; index < values.size(); ++index) {
			auto entry = validate(values[index], indexed_path(path, field, index));
			diagnostics.insert(diagnostics.end(), std::make_move_iterator(entry.begin()), std::make_move_iterator(entry.end()));
		}
	}

	template <typename T>
	void erase_defaults(std::vector<T>& values) {
		values.erase(std::remove(values.begin(), values.end(), T{}), values.end());
	}

	template <typename T, typename Canonicalize>
	void canonicalize_entries(std::vector<T>& values, Canonicalize canonicalize) {
		for (auto& value : values) {
			value = canonicalize(std::move(value));
		}
		erase_defaults(values);
	}

} // namespace gondola::lyrics::model::utils
