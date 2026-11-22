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

	inline std::uint32_t requireUint32(std::int64_t value) {
		if (value < 0 || value > static_cast<std::int64_t>(std::numeric_limits<std::uint32_t>::max())) {
			throw std::out_of_range("Value must fit in uint32");
		}
		return static_cast<std::uint32_t>(value);
	}

	inline std::string childPath(std::string_view parent, std::string_view child) {
		if (parent.empty()) {
			return std::string(child);
		}
		std::string path(parent);
		path += '.';
		path += child;
		return path;
	}

	inline std::string indexedPath(std::string_view parent, std::string_view field, std::size_t index) {
		auto path = childPath(parent, field);
		path += '[';
		path += std::to_string(index);
		path += ']';
		return path;
	}

	inline std::string lowercaseAscii(std::string_view value) {
		std::string result(value);
		for (auto& ch : result) {
			if (ch >= 'A' && ch <= 'Z') {
				ch = static_cast<char>(ch + ('a' - 'A'));
			}
		}
		return result;
	}

	inline std::string languageKey(const std::optional<std::string>& language) {
		return language ? lowercaseAscii(*language) : std::string{};
	}

	inline void normalizeLanguage(std::optional<std::string>& language) {
		if (language && language->empty()) {
			language.reset();
		} else if (language) {
			*language = lowercaseAscii(*language);
		}
	}

	inline void validateLanguage(const std::optional<std::string>& language, std::string_view parent, std::vector<common::Diagnostic>& diagnostics) {
		if (language && !language->empty() && !common::isWellFormedLanguageTag(*language)) {
			diagnostics.push_back({childPath(parent, "language"), common::DiagnosticCode::kLanguageTagMalformed});
		}
	}

	template <typename T, typename Key>
	void reportDuplicates(const std::vector<T>& values,
		Key                                 key,
		std::string_view                    path,
		std::string_view                    field,
		common::DiagnosticCode              code,
		std::vector<common::Diagnostic>&    diagnostics) {
		std::unordered_set<std::string> seen;
		for (std::size_t index = 0; index < values.size(); ++index) {
			if (!seen.insert(key(values[index])).second) {
				diagnostics.push_back({indexedPath(path, field, index), code});
			}
		}
	}

	template <typename T, typename Validate>
	void validateEntries(const std::vector<T>& values, Validate validate, std::string_view path, std::string_view field, std::vector<common::Diagnostic>& diagnostics) {
		for (std::size_t index = 0; index < values.size(); ++index) {
			auto entry = validate(values[index], indexedPath(path, field, index));
			diagnostics.insert(diagnostics.end(), std::make_move_iterator(entry.begin()), std::make_move_iterator(entry.end()));
		}
	}

	template <typename T>
	void eraseDefaults(std::vector<T>& values) {
		values.erase(std::remove(values.begin(), values.end(), T{}), values.end());
	}

	template <typename T, typename Canonicalize>
	void canonicalizeEntries(std::vector<T>& values, Canonicalize canonicalize) {
		for (auto& value : values) {
			value = canonicalize(std::move(value));
		}
		eraseDefaults(values);
	}

} // namespace gondola::lyrics::model::utils
