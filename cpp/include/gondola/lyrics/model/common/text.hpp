#pragma once

#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/common/text.gen.hpp>

namespace gondola::lyrics::model::common {
	/**
	 * Creates text with its optional language tag as supplied.
	 */
	[[nodiscard]] Text makeText(std::optional<std::string> language = std::nullopt, std::string text = {});

	/**
	 * Checks the text and its optional language tag.
	 */
	[[nodiscard]] std::vector<Diagnostic> validateText(const Text& text, std::string_view path = {});

	/**
	 * Lowercases the language tag and unsets an empty one.
	 */
	[[nodiscard]] Text canonicalizeText(Text text);

	/**
	 * Creates a source fragment with its timing and attributes.
	 */
	[[nodiscard]] TextToken makeTextToken(std::optional<TimeRange> time = std::nullopt, std::string text = {}, std::map<std::string, std::string> extra = {});

	/**
	 * Checks explicit timing and extension keys.
	 */
	[[nodiscard]] std::vector<Diagnostic> validateTextToken(const TextToken& token, std::string_view path = {});

	/**
	 * Preserves the fragment's source text, timing, and attributes in the canonical model.
	 */
	[[nodiscard]] TextToken canonicalizeTextToken(TextToken token);
} // namespace gondola::lyrics::model::common
