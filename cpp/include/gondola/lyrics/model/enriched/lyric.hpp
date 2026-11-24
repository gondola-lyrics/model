#pragma once

#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/enriched/lyric.gen.hpp>

namespace gondola::lyrics::model::enriched {
	/**
	 * Uses the current schema version and preserves supplied content without deriving timing or language usages.
	 *
	 * A status other than kValid or kInvalid throws std::invalid_argument; supplied content is not validated or normalized.
	 */
	[[nodiscard]] Lyric makeLyric(LyricStatus  status,
		std::string                        format         = {},
		std::string                        profile        = {},
		common::TimingLevel                timing         = common::TimingLevel::kUnspecified,
		std::optional<common::Meta>        meta           = std::nullopt,
		std::vector<common::Agent>         agents         = {},
		std::vector<Line>                  lines          = {},
		std::vector<LanguageUsage>         languageUsages = {},
		std::map<std::string, std::string> extra          = {});

	/**
	 * Checks schema-version syntax, status, references, timing, language usages, section boundaries, and nested data without changing the lyric.
	 *
	 * kInvalid does not skip these checks, and language usages must match the counts and order derived from normal lines.
	 * An empty result means these semantic checks passed; schema compatibility and UTF-8 encodability are separate checks.
	 * Diagnostic paths use the shared camelCase convention and zero-based indices.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateLyric(const Lyric& lyric);

	/**
	 * Orders lines and backgrounds stably by usable start times and language usages by descending count, then ascending ASCII-lowercased tag.
	 *
	 * Unset or invalid ranges stay at the end; language tag spelling and supplied counts are preserved.
	 */
	[[nodiscard]] Lyric orderLyric(Lyric lyric);

	/**
	 * Normalizes identifiers and nested data, removes default entries, and orders collections in the supplied value.
	 *
	 * Merges supplied language usages without recalculating them from lines; version, status, timing, and source text are preserved.
	 * The result still requires semantic validation.
	 */
	[[nodiscard]] Lyric canonicalizeLyric(Lyric lyric);

	/**
	 * Encodes a lyric as owned Protobuf bytes in a binary string that may contain NUL bytes.
	 *
	 * Returns nullopt for invalid UTF-8 in strings or a message larger than 2^31-1 bytes.
	 * Does not validate semantics, normalize the model, or check schema compatibility.
	 * Standard allocation and container exceptions propagate rather than returning nullopt.
	 */
	[[nodiscard]] std::optional<std::string> encode(const Lyric& lyric);

	/**
	 * Decodes Protobuf bytes into an owned lyric model.
	 *
	 * Returns nullopt for malformed wire data, invalid UTF-8 in known string fields, input larger than 2^31-1 bytes, or excessive unknown-group nesting.
	 * Empty input produces a default model; unknown fields are discarded, while unknown enum numbers are retained.
	 * Does not validate semantics, normalize the model, or check schema compatibility.
	 * The result does not borrow bytes; standard allocation and container exceptions propagate rather than returning nullopt.
	 */
	[[nodiscard]] std::optional<Lyric> decode(std::string_view bytes);
} // namespace gondola::lyrics::model::enriched
