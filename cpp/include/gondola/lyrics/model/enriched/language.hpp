#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/enriched/language.gen.hpp>

namespace gondola::lyrics::model::document {
	struct Line;
} // namespace gondola::lyrics::model::document

namespace gondola::lyrics::model::enriched {
	struct Line;

	// A count outside uint32 throws std::out_of_range.
	[[nodiscard]] LanguageUsage                   makeLanguageUsage(std::string tag = {}, std::int64_t lineCount = 0);
	[[nodiscard]] std::vector<common::Diagnostic> validateLanguageUsage(const LanguageUsage& usage, std::string_view path = {});

	// Counts each declared language once per normal line, including tags on its normal words.
	[[nodiscard]] std::vector<LanguageUsage> deriveLanguageUsages(const std::vector<Line>& lines);
	[[nodiscard]] std::vector<LanguageUsage> deriveLanguageUsages(const std::vector<document::Line>& lines);

	// Sorts by descending count then by tag, ignoring ASCII case and preserving source order on ties.
	[[nodiscard]] std::vector<LanguageUsage> orderLanguageUsages(std::vector<LanguageUsage> usages);

	// Merges normalized tags and caps counts at the uint32 limit.
	[[nodiscard]] std::vector<LanguageUsage> canonicalizeLanguageUsages(std::vector<LanguageUsage> usages);
} // namespace gondola::lyrics::model::enriched
