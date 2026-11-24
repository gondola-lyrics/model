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

	/**
	 * Preserves the supplied language tag and line count without normalization.
	 *
	 * A count outside uint32 throws std::out_of_range; tag validity is checked separately by validateLanguageUsage().
	 */
	[[nodiscard]] LanguageUsage makeLanguageUsage(std::string tag = {}, std::int64_t lineCount = 0);

	/**
	 * Requires a non-empty, syntactically well-formed language tag without comparing the count against any lyric.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateLanguageUsage(const LanguageUsage& usage, std::string_view path = {});

	/**
	 * Counts each distinct non-empty language declared on a normal line or its normal words once per line.
	 *
	 * Lowercases ASCII letters and sorts by descending count, then ascending tag; backgrounds and annotations do not contribute.
	 */
	[[nodiscard]] std::vector<LanguageUsage> deriveLanguageUsages(const std::vector<Line>& lines);

	/**
	 * Derives language usages from document lines using the same counting and ordering rules as enriched lines.
	 */
	[[nodiscard]] std::vector<LanguageUsage> deriveLanguageUsages(const std::vector<document::Line>& lines);

	/**
	 * Sorts by descending count, then ascending ASCII-lowercased tag, preserving source order on ties and the original tag spelling.
	 */
	[[nodiscard]] std::vector<LanguageUsage> orderLanguageUsages(std::vector<LanguageUsage> usages);

	/**
	 * Drops empty tags, merges ASCII-lowercased tags, and sorts by descending count, then ascending tag.
	 *
	 * Merged counts saturate at the uint32 limit; tag syntax and consistency with lyric lines are not validated.
	 */
	[[nodiscard]] std::vector<LanguageUsage> canonicalizeLanguageUsages(std::vector<LanguageUsage> usages);
} // namespace gondola::lyrics::model::enriched
