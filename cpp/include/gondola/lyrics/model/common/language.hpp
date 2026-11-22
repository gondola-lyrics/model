#pragma once

#include <cstddef>
#include <initializer_list>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace gondola::lyrics::model::common {
	/**
	 * Checks RFC 5646 syntax, including private use and grandfathered tags.
	 *
	 * Registry validity, uniqueness of variants and extension singletons, and extension semantics are outside this check.
	 */
	[[nodiscard]] bool isWellFormedLanguageTag(std::string_view tag) noexcept;

	/**
	 * Filters candidates by scheme before applying the language preferences.
	 */
	struct SchemePreference {
		// Unset allows any scheme, while an empty string selects entries with an unset or empty scheme.
		std::optional<std::string> scheme;

		// Earlier language preferences take priority over later ones.
		std::vector<std::string> languages;

		// The first eligible item is used when no preferred or untagged item exists and fallback is enabled.
		bool fallback = false;
	};

	namespace internal {
		bool        equalAsciiCaseInsensitive(std::string_view a, std::string_view b) noexcept;
		std::size_t scoreLanguageTag(std::string_view tag, std::string_view wanted) noexcept;

		inline std::string_view languageView(const std::optional<std::string>& value) noexcept {
			return value ? std::string_view(*value) : std::string_view{};
		}

		template <typename T, typename Languages, typename Filter>
		const T* pickLanguage(const std::vector<T>& items, const Languages& wanted, bool fallback, Filter filter) {
			for (std::string_view language : wanted) {
				if (language.empty()) {
					continue;
				}
				const T*    best      = nullptr;
				std::size_t bestScore = 0;
				for (const T& item : items) {
					if (!filter(item)) {
						continue;
					}
					const auto score = scoreLanguageTag(languageView(item.language), language);
					if (score > bestScore) {
						best      = std::addressof(item);
						bestScore = score;
					}
				}
				if (best) {
					return best;
				}
			}

			const T* first = nullptr;
			for (const T& item : items) {
				if (filter(item)) {
					if (languageView(item.language).empty()) {
						return std::addressof(item);
					}
					if (!first) {
						first = std::addressof(item);
					}
				}
			}
			return fallback ? first : nullptr;
		}
	} // namespace internal

	/**
	 * Selects by one language, matching without case on subtag boundaries.
	 *
	 * Uses the first untagged entry when there is no match and the first entry only if fallback is enabled.
	 * The result points into items and is subject to vector element invalidation.
	 */
	template <typename T>
	[[nodiscard]] const T* pickItemByLanguage(const std::vector<T>& items, std::string_view wanted = {}, bool fallback = false) {
		const std::string_view preferences[] = {wanted};
		return internal::pickLanguage(items, preferences, fallback, [](const T&) { return true; });
	}

	/**
	 * Tries languages in preference order, taking the closest match and preserving source order on ties.
	 *
	 * Empty preferences are skipped, and fallback is applied only after all preferences fail.
	 * The result points into items and is subject to vector element invalidation.
	 */
	template <typename T>
	[[nodiscard]] const T* pickItemByLanguage(const std::vector<T>& items, const std::vector<std::string>& wanted, bool fallback = false) {
		return internal::pickLanguage(items, wanted, fallback, [](const T&) { return true; });
	}

	/**
	 * Accepts a braced list of ordered language preferences.
	 *
	 * The result points into items and is subject to vector element invalidation.
	 */
	template <typename T>
	[[nodiscard]] const T* pickItemByLanguage(const std::vector<T>& items, std::initializer_list<std::string_view> wanted, bool fallback = false) {
		return internal::pickLanguage(items, wanted, fallback, [](const T&) { return true; });
	}

	/**
	 * Selects by exact scheme, ignoring ASCII case, then applies the ordered language preferences.
	 *
	 * Untagged and first item fallback remain within the eligible schemes.
	 * The result points into items and is subject to vector element invalidation.
	 */
	template <typename T>
	[[nodiscard]] const T* pickItemByScheme(const std::vector<T>& items, const SchemePreference& preference = {}) {
		return internal::pickLanguage(items, preference.languages, preference.fallback, [&](const T& item) {
			return !preference.scheme || internal::equalAsciiCaseInsensitive(internal::languageView(item.scheme), *preference.scheme);
		});
	}

	// A pointer to the selected item would dangle when the temporary vector is destroyed.
	template <typename T>
	const T* pickItemByLanguage(const std::vector<T>&&, std::string_view = {}, bool = false) = delete;

	template <typename T>
	const T* pickItemByLanguage(const std::vector<T>&&, const std::vector<std::string>&, bool = false) = delete;

	template <typename T>
	const T* pickItemByLanguage(const std::vector<T>&&, std::initializer_list<std::string_view>, bool = false) = delete;

	template <typename T>
	const T* pickItemByScheme(const std::vector<T>&&, const SchemePreference& = {}) = delete;
} // namespace gondola::lyrics::model::common
